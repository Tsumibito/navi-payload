# OG Image Actions

## Описание

Компонент `OgImageActions` добавляет две кнопки под полем Open Graph Image для автоматизации работы с OG изображениями.

## Расположение

- **Компонент**: `/src/components/OgImageActions.tsx`
- **Поле**: `seo.og_image` (Upload field)
- **Коллекции**: posts, tags, team

## Функционал

### 1. Кнопка "Использовать изображение/фото"

- **Назначение**: Копирует основное изображение сущности в OG Image
- **Поля источника**:
  - Posts: `image`
  - Tags: `image`
  - Team: `photo`
- **Логика**: Извлекает ID из relationship поля и устанавливает его как OG Image

### 2. Кнопка "Сделать скриншот страницы"

- **Назначение**: Создает скриншот опубликованной страницы и устанавливает как OG Image
- **Требования**: Наличие поля `slug`
- **URL паттерны**:
  - Posts: `https://navi.training/{lang}/blog/{slug}`
  - Tags: `https://navi.training/{lang}/tags/{slug}`
  - Team: `https://navi.training/{lang}/team/{slug}`
- **Язык**: Определяется из поля `language` (по умолчанию `ru`)

## Конфигурация коллекций

```typescript
const COLLECTION_CONFIGS = {
  posts: {
    imageField: 'image',
    urlPattern: '/ru/blog/{slug}',
    collection: 'blog',
  },
  tags: {
    imageField: 'image',
    urlPattern: '/ru/tags/{slug}',
    collection: 'tags',
  },
  team: {
    imageField: 'photo',
    urlPattern: '/ru/team/{slug}',
    collection: 'team',
  },
};
```

## API Endpoint для скриншотов

**Требуется создать**: `/api/screenshot`

### Request

```typescript
POST /api/screenshot
Content-Type: application/json

{
  "url": "https://navi.training/ru/blog/example-slug"
}
```

### Response

```typescript
{
  "imageId": "uuid-of-uploaded-image"
}
```

### Логика endpoint:

1. Принимает URL страницы
2. Делает скриншот через Puppeteer/Playwright
3. Оптимизирует изображение (1200x630px, webp)
4. Загружает в коллекцию `media`
5. Возвращает ID загруженного изображения

## Состояния кнопок

### "Использовать изображение"

- **Активна**: Есть изображение в соответствующем поле
- **Неактивна**: Нет изображения или идет обработка
- **Цвет**: Синий (#2563eb) когда активна

### "Сделать скриншот"

- **Активна**: Есть slug
- **Неактивна**: Нет slug или идет обработка
- **Цвет**: Зеленый (#10b981) когда активна
- **Процесс**: Показывает "Создание скриншота..." во время работы

## Обработка ошибок

Ошибки отображаются под кнопками в красном блоке:
- "Нет изображения для использования"
- "Не удалось получить ID изображения"
- "Неизвестная коллекция"
- "Нет slug для создания скриншота"
- "Ошибка создания скриншота: {status}"
- "API не вернул ID изображения"

## Расширение на новые коллекции

Для добавления поддержки новой коллекции:

1. Добавить конфигурацию в `COLLECTION_CONFIGS`:
```typescript
newCollection: {
  imageField: 'main_image', // Поле с изображением
  urlPattern: '/ru/new/{slug}', // URL паттерн
  collection: 'new', // Название для URL
}
```

2. Компонент автоматически определит коллекцию из URL админки

## Интеграция

Компонент автоматически подключается к полю `seo.og_image` через:

```typescript
{
  type: 'upload',
  name: 'og_image',
  admin: {
    components: {
      afterInput: ['/src/components/OgImageActions#OgImageActions'],
    },
  },
}
```

## TODO

- [ ] Создать endpoint `/api/screenshot`
- [ ] Настроить Puppeteer/Playwright для скриншотов
- [ ] Добавить поддержку других коллекций (certificates, trainings, etc.)
- [ ] Добавить предпросмотр скриншота перед сохранением
- [ ] Кеширование скриншотов по URL
