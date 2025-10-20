import sharp from 'sharp'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { Client } from 'pg'
import { Readable } from 'stream'

/**
 * Скрипт регенерации размеров изображений для существующих файлов в Cloudflare R2
 * 
 * Этот скрипт:
 * 1. Загружает список всех изображений из БД
 * 2. Скачивает оригинал из R2
 * 3. Генерирует все размеры (thumbnail, post, card, og, featured)
 * 4. Загружает размеры обратно в R2
 * 5. Обновляет метаданные в БД
 */

interface ImageSize {
  name: string
  width: number
  height?: number
  fit: 'cover' | 'inside'
  position?: 'centre'
  format: 'webp'
  quality: number
}

const imageSizes: ImageSize[] = [
  {
    name: 'thumbnail',
    width: 150,
    height: 150,
    fit: 'cover',
    position: 'centre',
    format: 'webp',
    quality: 80,
  },
  {
    name: 'post',
    width: 800,
    fit: 'inside',
    format: 'webp',
    quality: 85,
  },
  {
    name: 'card',
    width: 640,
    fit: 'inside',
    format: 'webp',
    quality: 85,
  },
  {
    name: 'og',
    width: 1200,
    height: 630,
    fit: 'cover',
    position: 'centre',
    format: 'webp',
    quality: 90,
  },
  {
    name: 'featured',
    width: 1920,
    fit: 'inside',
    format: 'webp',
    quality: 90,
  },
]

// Настройка S3 клиента для Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? '',
  },
})

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? ''
const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL ?? ''

/**
 * Скачивает файл из R2
 */
async function downloadFromR2(filename: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: filename,
  })

  const response = await s3Client.send(command)
  const stream = response.Body as Readable
  
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

/**
 * Загружает файл в R2
 */
async function uploadToR2(filename: string, buffer: Buffer, mimeType: string): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: filename,
    Body: buffer,
    ContentType: mimeType,
  })

  await s3Client.send(command)
}

/**
 * Генерирует размер изображения
 */
async function generateImageSize(
  originalBuffer: Buffer,
  size: ImageSize,
  originalFilename: string,
): Promise<{
  buffer: Buffer
  width: number
  height: number
  filesize: number
  filename: string
}> {
  const filenameParts = originalFilename.split('.')
  const ext = filenameParts.pop()
  const baseName = filenameParts.join('.')
  
  const outputFilename = `${baseName}-${size.width}${size.height ? `x${size.height}` : ''}.webp`

  let sharpInstance = sharp(originalBuffer)

  if (size.height) {
    // Фиксированный размер с fit
    sharpInstance = sharpInstance.resize(size.width, size.height, {
      fit: size.fit,
      position: size.position || 'centre',
    })
  } else {
    // Только ширина, сохраняем пропорции
    sharpInstance = sharpInstance.resize(size.width, undefined, {
      fit: size.fit,
    })
  }

  const buffer = await sharpInstance
    .webp({ quality: size.quality })
    .toBuffer({ resolveWithObject: true })

  return {
    buffer: buffer.data,
    width: buffer.info.width,
    height: buffer.info.height,
    filesize: buffer.data.length,
    filename: outputFilename,
  }
}

async function regenerateImageSizes() {
  console.log('🚀 Запуск регенерации размеров изображений в R2...\n')

  // Подключаемся к PostgreSQL
  const client = new Client({
    connectionString: process.env.DATABASE_URI,
  })

  await client.connect()
  console.log('✅ Подключено к PostgreSQL\n')

  // Получаем все media файлы
  const result = await client.query(`
    SELECT id, filename, mime_type, url
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
    const mediaId = media.id as number

    console.log(`\n🖼️  Обработка [${processed + 1}/${mediaFiles.length}]: ${filename}`)

    try {
      // Скачиваем оригинал из R2
      console.log(`   📥 Скачивание из R2...`)
      const originalBuffer = await downloadFromR2(filename)
      
      const image = sharp(originalBuffer)
      const metadata = await image.metadata()
      console.log(`   📐 Оригинал: ${metadata.width}×${metadata.height}`)

      // Генерируем каждый размер
      const updates: string[] = []
      
      for (const size of imageSizes) {
        console.log(`   🔧 Генерация ${size.name}...`)
        
        const result = await generateImageSize(originalBuffer, size, filename)
        
        // Загружаем в R2
        console.log(`   📤 Загрузка ${result.filename} в R2...`)
        await uploadToR2(result.filename, result.buffer, 'image/webp')
        
        const url = `${PUBLIC_URL}/${result.filename}`
        
        // Собираем SQL для обновления
        updates.push(`
          sizes_${size.name}_url = '${url}',
          sizes_${size.name}_width = ${result.width},
          sizes_${size.name}_height = ${result.height},
          sizes_${size.name}_mime_type = 'image/webp',
          sizes_${size.name}_filesize = ${result.filesize},
          sizes_${size.name}_filename = '${result.filename}'
        `)
        
        console.log(`   ✅ ${size.name}: ${result.width}×${result.height} (${Math.round(result.filesize / 1024)}KB)`)
      }

      // Обновляем запись в БД
      const updateQuery = `
        UPDATE media
        SET ${updates.join(',\n')}
        WHERE id = ${mediaId}
      `
      
      await client.query(updateQuery)
      console.log(`   💾 БД обновлена`)
      
      processed++
    } catch (error) {
      console.error(`   ❌ Ошибка: ${error instanceof Error ? error.message : 'Unknown'}`)
      errors++
    }
  }

  await client.end()

  console.log('\n' + '='.repeat(60))
  console.log(`✅ Регенерация завершена!`)
  console.log(`📊 Обработано: ${processed}`)
  console.log(`⏭️  Пропущено: ${skipped}`)
  console.log(`❌ Ошибок: ${errors}`)
  console.log('='.repeat(60))
}

// Запуск
regenerateImageSizes().catch((error) => {
  console.error('❌ Критическая ошибка:', error)
  process.exit(1)
})
