import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: {
    // Автоматическая генерация размеров для оптимизации админки
    imageSizes: [
      {
        name: 'thumbnail',
        width: 150,
        height: 150,
        fit: 'cover', // Обрезаем для квадрата админки
        position: 'centre',
        formatOptions: {
          format: 'webp',
          options: {
            quality: 80,
          },
        },
      },
      {
        name: 'post',
        width: 800,
        // Без height - сохраняет пропорции оригинала
        fit: 'inside', // Вписывает без обрезки
        formatOptions: {
          format: 'webp',
          options: {
            quality: 85,
          },
        },
      },
      {
        name: 'card',
        width: 640,
        // Без height - сохраняет пропорции
        fit: 'inside',
        formatOptions: {
          format: 'webp',
          options: {
            quality: 85,
          },
        },
      },
      {
        name: 'og',
        width: 1200,
        height: 630,
        fit: 'cover', // OG требует строгое соотношение 1.91:1
        position: 'centre',
        formatOptions: {
          format: 'webp',
          options: {
            quality: 90,
          },
        },
      },
      {
        name: 'featured',
        width: 1920,
        // Без height - сохраняет пропорции для больших экранов
        fit: 'inside',
        formatOptions: {
          format: 'webp',
          options: {
            quality: 90,
          },
        },
      },
    ],
    // Устанавливаем разумные лимиты размера файла
    mimeTypes: ['image/*'],
    adminThumbnail: 'thumbnail', // Админка будет использовать thumbnail
  },
}
