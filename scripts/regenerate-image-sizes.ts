import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { Client } from 'pg'

/**
 * Скрипт регенерации размеров изображений для существующих файлов
 * Работает напрямую с файловой системой и PostgreSQL без загрузки Payload
 */

const imageSizes = [
  {
    name: 'thumbnail',
    width: 150,
    height: 150,
    fit: 'cover' as const,
    position: 'centre' as const,
    format: 'webp' as const,
    quality: 80,
  },
  {
    name: 'post',
    width: 800,
    fit: 'inside' as const,
    format: 'webp' as const,
    quality: 85,
  },
  {
    name: 'card',
    width: 640,
    fit: 'inside' as const,
    format: 'webp' as const,
    quality: 85,
  },
  {
    name: 'og',
    width: 1200,
    height: 630,
    fit: 'cover' as const,
    position: 'centre' as const,
    format: 'webp' as const,
    quality: 90,
  },
  {
    name: 'featured',
    width: 1920,
    fit: 'inside' as const,
    format: 'webp' as const,
    quality: 90,
  },
]

async function regenerateImageSizes() {
  console.log('🚀 Запуск регенерации размеров изображений...\n')

  // Подключаемся к PostgreSQL
  const client = new Client({
    connectionString: process.env.DATABASE_URI,
  })

  await client.connect()
  console.log('✅ Подключено к PostgreSQL\n')

  // Получаем все media файлы
  const result = await client.query(`
    SELECT id, filename, mime_type
    FROM media
    WHERE mime_type LIKE 'image/%'
    ORDER BY id
  `)

  const mediaFiles = result.rows
  console.log(`📦 Найдено ${mediaFiles.length} изображений\n`)

  let processed = 0
  let skipped = 0
  let errors = 0

  for (const media of mediaFiles) {
    const filename = media.filename as string
    const originalPath = path.join(process.cwd(), 'public/media', filename)

    // Проверяем существование оригинала
    if (!fs.existsSync(originalPath)) {
      console.log(`⚠️  Пропускаем ${filename}: файл не найден`)
      skipped++
      continue
    }

    console.log(`\n🖼️  Обработка: ${filename}`)

    try {
      const image = sharp(originalPath)
      const metadata = await image.metadata()

      console.log(`   Оригинал: ${metadata.width}×${metadata.height}`)

      // Генерируем каждый размер
      for (const size of imageSizes) {
        const outputFilename = `${path.parse(filename).name}-${size.width}${size.height ? `x${size.height}` : ''}.${size.format}`
        const outputPath = path.join(process.cwd(), 'public/media', outputFilename)

        // Создаем sharp instance для каждого размера
        let resizer = sharp(originalPath)

        // Применяем resize с соответствующими параметрами
        const resizeOptions: {
          width: number
          height?: number
          fit: 'cover' | 'inside'
          position?: 'centre'
        } = {
          width: size.width,
          fit: size.fit,
        }

        if (size.height) {
          resizeOptions.height = size.height
        }

        if (size.position) {
          resizeOptions.position = size.position
        }

        resizer = resizer.resize(resizeOptions)

        // Конвертируем в webp с качеством
        if (size.format === 'webp') {
          resizer = resizer.webp({ quality: size.quality })
        }

        // Сохраняем
        await resizer.toFile(outputPath)

        const stats = fs.statSync(outputPath)
        const sizeKb = (stats.size / 1024).toFixed(1)
        console.log(`   ✅ ${size.name}: ${outputFilename} (${sizeKb} KB)`)
      }

      // Обновляем запись в БД с информацией о размерах
      const sizes: Record<string, {
        filename: string
        mimeType: string
        filesize: number
        width?: number
        height?: number
        url: string
      }> = {}
      for (const size of imageSizes) {
        const sizeFilename = `${path.parse(filename).name}-${size.width}${size.height ? `x${size.height}` : ''}.${size.format}`
        const sizePath = path.join(process.cwd(), 'public/media', sizeFilename)
        
        if (fs.existsSync(sizePath)) {
          const stats = fs.statSync(sizePath)
          const sizeMetadata = await sharp(sizePath).metadata()
          
          sizes[size.name] = {
            filename: sizeFilename,
            mimeType: `image/${size.format}`,
            filesize: stats.size,
            width: sizeMetadata.width,
            height: sizeMetadata.height,
            url: `/media/${sizeFilename}`,
          }
        }
      }

      // Обновляем документ в PostgreSQL
      await client.query(
        `UPDATE media SET sizes = $1 WHERE id = $2`,
        [JSON.stringify(sizes), media.id]
      )

      processed++
      console.log(`   💾 Метаданные обновлены`)
    } catch (error) {
      console.error(`   ❌ Ошибка обработки ${filename}:`, error)
      errors++
    }
  }

  // Закрываем соединение
  await client.end()

  console.log(`\n\n📊 Статистика:`)
  console.log(`   ✅ Обработано: ${processed}`)
  console.log(`   ⚠️  Пропущено: ${skipped}`)
  console.log(`   ❌ Ошибок: ${errors}`)
  console.log(`\n✨ Готово!\n`)

  process.exit(0)
}

regenerateImageSizes().catch((error) => {
  console.error('❌ Критическая ошибка:', error)
  process.exit(1)
})
