# Payload CMS Features — Navi.training

## Миграция Sanity → Payload

### Результаты миграции
**Дата:** 2025-09-30  
**Статус:** ✅ Успешно завершена

#### Импортированные данные
- **Certificates:** 7 записей (created)
- **Tags:** 55 записей (created)
- **Team:** 3 записи (created)
- **Posts:** 44 записи (created) — **все с авторами и тегами**
- **Redirects:** 264 записи (created)
- **Globals:** 1 запись (updated)
- **Trainings:** 0 записей
- **FAQs:** 0 записей

#### Связи между сущностями
- **Author relations:** 44 (100% постов имеют автора)
- **Tag relations:** 476 (в среднем ~11 тегов на пост)
- **Обратные связи:** tags→posts, team→posts (через `resolvePendingRelations`)

#### Особенности реализации

**Конвертация контента (PortableText → Lexical):**
- Сохранение структуры параграфов и заголовков (h1-h6)
- Поддержка форматирования текста (bold, italic, underline, code)
- **Изображения:** загрузка в коллекцию `media` с конвертацией в Lexical `upload` nodes
- **Ссылки:** сохранение внутренних и внешних ссылок с атрибутами `url`, `newTab`, `linkType`
- Обработка `markDefs` для корректной конвертации аннотированного текста

**Переводы:**
- Автоматическое определение языка (ru/ua/en)
- Генерация осмысленных названий переводов: `Translation RU`, `Translation EN`, `Translation UA`
- Полная конвертация контента переводов с сохранением изображений и ссылок

**Связи между сущностями:**
- Резолвинг отложенных связей через `resolvePendingRelations()`
- Связи `tags ↔ posts`, `tags ↔ faqs`, `faqs ↔ posts`, `team ↔ posts`
- Корректное сопоставление Sanity ID → Payload ID через `sanityToPayload` Map

**Медиа-файлы:**
- Загрузка изображений из Sanity CDN (`https://cdn.sanity.io/images/...`)
- Кэширование загруженных файлов для избежания дубликатов
- Поддержка `--skip-media` для dry-run без загрузки файлов

**Обработка ошибок:**
- Try-catch блоки для каждого тега/поста/редиректа
- Детальный вывод ошибок валидации Payload
- Продолжение миграции при ошибках отдельных записей

#### Известные проблемы
- **Team translations:** 6 переводов пропущены (unsupported language codes)
- **Redirects:** 6 записей с пустыми `from_path`/`to_path` не импортированы

#### Скрипт миграции
**Файл:** `scripts/migrate-sanity-to-payload.ts`

**Запуск:**
```bash
# Dry-run (без изменений в БД)
npm run migrate:sanity -- --dry-run

# Dry-run без загрузки медиа
npm run migrate:sanity -- --dry-run --skip-media

# Полная миграция
npm run migrate:sanity
```

**Основные функции:**
- `portableTextToLexical()` — конвертация PortableText в Lexical JSON с поддержкой изображений и ссылок
- `uploadMedia()` — загрузка изображений из Sanity CDN в Payload media collection
- `mapTranslation()` — обработка переводов с автоопределением языка
- `mapSeo()` — миграция SEO-полей (title, meta_description, og_image, focus_keyphrase)
- `ingestCertificates/Tags/Team/Posts/Redirects/Globals()` — импорт каждой коллекции
- `resolvePendingRelations()` — финальное связывание сущностей

---

## Коллекции

### Posts
- **Поля:** name, slug, author (relation → team), image, summary, socialImages (thumbnail, image16x9, image5x4), content (Lexical), tags (relation → tags), faqs (relation → faqs), translations, seo, featured, publishedAt
- **Переводы:** ru, ua, en
- **Связи:** author → team, tags → tags[], faqs → faqs[]

### Tags
- **Поля:** name, slug, image, summary, content (Lexical), descriptionForAI, posts (relation → posts), faqs (relation → faqs), translations, seo
- **Переводы:** ru, ua, en
- **Связи:** posts → posts[], faqs → faqs[]

### Team
- **Поля:** name, slug, position, bioSummary, bio (Lexical), photo, email, links (service, url), certificates (relation → certificates), trainings (relation → trainings), faqs (relation → faqs), posts (relation → posts), translations, seo
- **Переводы:** ru, ua, en (частично)
- **Связи:** certificates → certificates[], trainings → trainings[], faqs → faqs[], posts → posts[]

### Certificates
- **Поля:** title, slug, image, description (Lexical), issuer, issuedDate, expiryDate, translations, seo
- **Переводы:** ru, ua, en

### Redirects
- **Поля:** fromPath, toPath, statusCode, createdAtOverride
- **Импортировано:** 264 редиректа из Sanity

### Globals (SiteGlobals)
- **Поля:** title, tagline, description, url, favicon, logo, logoDarkMode, accentColor, socialLinks (service, url)

---

## Технологии
- **CMS:** Payload CMS v3
- **Database:** PostgreSQL (Docker, port 5433)
- **Rich Text:** Lexical Editor
- **Media Storage:** Local filesystem (планируется Cloudflare R2)
- **Frontend:** Next.js 15 (Turbopack)

---

## Новые фичи (2025-09-30)

### 1. Интерфейс с закладками (Tabs)
**Что делает:** Организует поля в удобные вкладки для лучшей навигации

**Где реализовано:**
- `src/collections/Posts.ts` — вкладки: Основное, Контент, Связи, SEO, Переводы
- `src/collections/Tags.ts` — вкладки: Основное, Контент, Связи, SEO, Переводы

**Преимущества:**
- Отдельная вкладка **SEO** для всех SEO-полей
- Отдельная вкладка **Переводы** для переводов на другие языки
- Вкладка **Контент** с ограниченной шириной (800px) для удобного редактирования
- Логическая группировка полей

**Как тестировать:**
1. Откройте пост или тег в админке
2. Переключайтесь между вкладками
3. Проверьте, что все поля доступны и работают

### 2. Редактор без h1 с ограниченной шириной
**Что делает:** Настраивает Lexical редактор для корректной работы с контентом

**Где реализовано:**
- `src/utils/lexicalConfig.ts` — конфигурация редактора
- Используется в `Posts`, `Tags` и переводах

**Настройки:**
- **Заголовки:** h2, h3, h4, h5, h6 (h1 отключен)
- **Форматирование:** жирный, курсив, подчеркнутый, зачеркнутый, код
- **Списки:** нумерованные, маркированные
- **Ссылки:** внутренние (posts, tags) и внешние
- **Разделители:** горизонтальные линии
- **Ширина:** максимум 800px для удобного чтения

**Как тестировать:**
1. Откройте вкладку "Контент" в посте
2. Попробуйте добавить заголовок — h1 не должен быть доступен
3. Проверьте, что контент не растягивается на всю ширину экрана

### 3. AI генерация summary (OpenRouter)
**Что делает:** Автоматически генерирует краткое описание из контента с помощью AI

**Где реализовано:**
- `src/app/api/ai/generate-summary/route.ts` — API endpoint
- `src/components/GenerateSummaryButton.tsx` — UI компонент
- Используется в `Posts` и `Tags` (основное и переводы)

**Данные:**
- **Модель:** Claude 3.5 Sonnet (через OpenRouter)
- **Токен:** `OPENROUTER_TOKEN` из `.env`
- **Языки:** ru, ua, en (автоопределение из поля `language`)
- **Типы:** post (2-3 предложения), tag (1-2 предложения)

**Как работает:**
1. Извлекает текст из Lexical JSON контента
2. Отправляет запрос к OpenRouter API с контекстом (заголовок + контент)
3. Получает AI-сгенерированное описание
4. Автоматически заполняет поле `summary`

**Как тестировать:**
1. Создайте пост с контентом (минимум 50 символов)
2. Нажмите кнопку "✨ Сгенерировать описание" над полем Summary
3. Дождитесь генерации (2-5 секунд)
4. Проверьте, что поле Summary заполнилось

**API:**
- **Endpoint:** `POST /api/ai/generate-summary`
- **Body:** `{ content: string, language: 'ru'|'ua'|'en', title?: string, kind?: 'post'|'tag' }`
- **Response:** `{ summary: string }`

### 4. Генерация slug из названия
**Что делает:** Автоматически создает URL-friendly slug из названия с поддержкой кириллицы

**Где реализовано:**
- `src/utils/slug.ts` — утилиты транслитерации
- `src/components/GenerateSlugButton.tsx` — UI компонент
- Используется в `Posts`, `Tags` и их переводах

**Поддержка языков:**
- **Русский:** а-я, А-Я → a-ya, A-YA
- **Украинский:** ґ, є, і, ї → g, ye, i, yi
- **Английский:** без изменений

**Как работает:**
1. Берет значение из поля `name`
2. Транслитерирует кириллицу в латиницу
3. Приводит к lowercase
4. Удаляет спецсимволы
5. Заменяет пробелы на дефисы
6. Ограничивает длину до 100 символов

**Как тестировать:**
1. Введите название на русском: "Что подарить яхтсмену?"
2. Нажмите кнопку "✨ Сгенерировать slug" рядом с полем Slug
3. Проверьте результат: "chto-podarit-yahtsmenu"

### 5. Система черновиков (Drafts)
**Что делает:** Позволяет сохранять посты и теги как черновики

**Где реализовано:**
- `src/collections/Posts.ts` — `versions.drafts.autosave`
- `src/collections/Tags.ts` — `versions.drafts.autosave`

**Как работает:**
- **Автосохранение:** каждые 2 секунды
- **Статусы:** draft, published
- **Колонка:** `_status` в списке постов/тегов

**Как использовать:**
1. Создайте новый пост — по умолчанию это черновик
2. Редактируйте контент — он автоматически сохраняется
3. Нажмите **"Publish"** в правом верхнем углу для публикации
4. Или нажмите **"Save as Draft"** для сохранения как черновик

**Как тестировать:**
1. Создайте пост, не публикуя его
2. Проверьте колонку `_status` в списке — должно быть "Draft"
3. Опубликуйте пост
4. Проверьте статус — должно быть "Published"

---

## Переиспользование фич

### AI Summary в других коллекциях
```typescript
// В любой коллекции
{
  type: 'ui',
  name: 'summaryGenerator',
  admin: {
    components: {
      Field: '/src/components/GenerateSummaryButton#GenerateSummaryButton',
    },
  },
},
{
  type: 'textarea',
  name: 'summary',
  label: 'Краткое описание',
}
```

### Slug Generator в других коллекциях
```typescript
{
  type: 'text',
  name: 'slug',
  label: 'Slug',
  required: true,
  unique: true,
  admin: {
    components: {
      afterInput: ['/src/components/GenerateSlugButton#GenerateSlugButton'],
    },
  },
}
```

### Tabs интерфейс
```typescript
fields: [
  {
    type: 'tabs',
    tabs: [
      {
        label: 'Основное',
        fields: [/* основные поля */],
      },
      {
        label: 'SEO',
        fields: [createSeoField()],
      },
    ],
  },
]
```

---

## Следующие шаги
- [x] Настроить Cloudflare R2 для хранения медиа
- [x] Добавить AI summary feature
- [x] Интерфейс с закладками
- [x] Генерация slug из названия
- [x] Система черновиков
- [ ] Добавить недостающие переводы Team
- [ ] Проверить корректность отображения контента с изображениями и ссылками
- [ ] Настроить фронтенд ASTRO для работы с Payload API
