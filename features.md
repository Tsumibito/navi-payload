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
- **Поля:** name, slug, author (relation → team), image, summary, content (Lexical), tags (relation → tags), faqs (relation → faqs), translations, seo, featured, publishedAt, socialImages (thumbnail, image16x9, image5x4)
- **Вкладки:** Content, Technical (социальные изображения), SEO, Translations
- **Переводы:** ru, ua, en
- **Связи:** author → team, tags → tags[], faqs → faqs[]

- **Поля:** name, slug, image, summary, content (Lexical), descriptionForAI, posts (relation → posts), faqs (relation → faqs), translations, seo, socialImages (thumbnail, image16x9, image5x4)
- **Вкладки:** Content, Technical (Description for AI, социальные изображения), SEO, Translations
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

**UI обновление (2025-10-01):** кнопка `Generate Summary` отображается рядом с лейблом поля Summary (над самим полем), сохранена иконка ✨ и добавлен продолговатый стиль со скруглениями; ошибки выводятся рядом с кнопкой.

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

**UI обновление (2025-10-01):** кнопка `Generate Slug` отображается справа от лейбла (над полем) с продолговатым стилем и иконкой ✨.

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

## Локализация (2025-10-12)

### Архитектура переводов: translations array

**Решение:** Используем проверенную схему с массивом `translations` вместо встроенной локализации Payload v3.

**Причина:** 
- ✅ Все данные уже мигрированы из Sanity с этой схемой
- ✅ Работает стабильно без конфликтов БД
- ✅ Поддерживает все необходимые языки (ru, ua, en)
- ✅ Проще контроль версий и миграции
- ⚠️ Требует фильтрацию по `translations.language` в API

**Структура:**
```typescript
{
  name: "Название на русском",
  slug: "slug-na-russkom",
  translations: [
    { 
      language: "ua", 
      name: "Назва українською", 
      slug: "slug-ukrainskoyu",
      summary: "Короткий опис",
      content: { /* Lexical JSON */ },
      seo: { /* SEO поля */ }
    },
    { language: "en", name: "Name in English", slug: "slug-in-english" }
  ]
}
```

**Коллекции с переводами:**
- **Posts**: 44 записи + 86 переводов
- **Tags**: 55 записей + 110 переводов
- **Team**: 3 записи (без переводов пока)
- **Certificates**: 7 записей

**Поля переводов** реализованы в `src/fields/translation.ts`:
- `language` - код языка ('ru' | 'ua' | 'en')
- `name` - название
- `slug` - URL slug
- `summary` - краткое описание
- `content` - Lexical контент
- `seo` - SEO поля (title, meta_description, focus_keyphrase, link_keywords)

**Альтернатива (если понадобится):** План поэтапной миграции на встроенную локализацию находится в `LOCALIZATION-MIGRATION-PLAN.md`.

---

## Исправление бесконечных циклов в SEO модулях (2025-10-14)

### Проблема
SEO компоненты (`SeoKeywordManager`, `FocusKeyphraseAnalyzer`) вызывали бесконечные циклы обновлений с ошибками:
- `Maximum update depth exceeded`
- `Component repeatedly calls setState inside componentWillUpdate`

### Причина
**Синхронные dispatch внутри setState:**
- Компоненты вызывали `dispatch()` (обновление формы) напрямую внутри `setState`
- Это создавало цепную реакцию: setState → dispatch → форма обновляется → новый setState → цикл
- `localValue` был в зависимостях `useEffect`, что усугубляло проблему

### Решение

**Файлы:**
- `/src/components/SeoKeywordManager.tsx` — управление Link Keywords
- `/src/components/FocusKeyphraseAnalyzer.tsx` — анализ Focus Keyphrase

**Изменения:**

1. **Асинхронный коммит через отложенное состояние:**
   ```typescript
   // Было: синхронный dispatch внутри setState
   setLocalValue(next);
   dispatch({ type: 'UPDATE', path, value: next });
   
   // Стало: отложенный коммит
   setLocalValue(next);
   setPendingCommit({ value: next, string: nextString });
   
   // Отдельный useEffect для коммита
   useEffect(() => {
     if (!pendingCommit) return;
     dispatch({ type: 'UPDATE', path, value: pendingCommit.value });
     setPendingCommit(null);
   }, [pendingCommit]);
   ```

2. **Использование refs для неизменяемых данных:**
   - `dispatchRef`, `pathRef`, `stringPathRef` — вместо прямых зависимостей
   - Предотвращает лишние ре-рендеры при обновлении этих значений

3. **Контроль синхронизации с внешним состоянием:**
   ```typescript
   // Синхронизация блокируется во время коммита
   useEffect(() => {
     if (pendingCommit) return; // Не обновлять во время коммита
     if (!deepEqual(localValue, externalValue)) {
       setLocalValue(externalValue);
     }
   }, [externalSignature, pendingCommit, localValue]);
   ```

4. **Проверка изменений контента через signature:**
   - Автообогащение keywords запускается только при реальном изменении контента
   - Используется `createContentSignature()` для сравнения

**Результат:**
- ✅ Нет бесконечных циклов
- ✅ Корректное обновление формы без race conditions
- ✅ Автообогащение keywords работает при изменении контента
- ✅ UI остается отзывчивым

### Улучшения интерфейса и логики пересчета (2025-10-14, 20:00)

**Проблемы:**
- Пересчет происходил при каждой загрузке страницы
- Timestamp показывал текущее время вместо времени последнего реального пересчета
- Не было кнопки "Пересчитать" в Link Keywords
- Данные не сохранялись в БД

**Исправления:**

1. **Добавлены поля для кэширования в БД:**
   - `seo.focus_keyphrase_stats` (json) — статистика Focus Keyphrase
   - `seo.additional_fields` (json) — данные Link Keywords с кэшированными счетчиками

2. **Изменена логика пересчета:**
   - **Автоматический пересчет** только при первом открытии (если данных еще нет)
   - **Ручной пересчет** по кнопке "Пересчитать" в обоих компонентах
   - Данные сохраняются в БД и загружаются оттуда при следующем открытии

3. **Улучшен UI:**
   - Добавлена кнопка "Пересчитать" в Link Keywords
   - Timestamp отображает реальное время последнего пересчета в формате `ДД/ММ/ГГГГ, ЧЧ:ММ`
   - Улучшены стили кнопок (hover эффекты, disabled состояния)
   - Кнопка "Пересчитать" неактивна если нет данных для пересчета

4. **Скрыты технические поля:**
   - `seo.link_keywords` (textarea) — скрыто, используется только для fallback
   - `seo.focus_keyphrase_stats` и `seo.additional_fields` — скрыты и readonly

### Тестирование
1. Откройте пост в админке
2. Перейдите на вкладку SEO
3. Введите **Focus Keyphrase** — проверьте автоматический пересчет (только первый раз)
4. Добавьте **Link Keyword** — проверьте, что нет ошибок в консоли
5. Нажмите **"Пересчитать"** в обоих секциях — проверьте обновление данных
6. **Сохраните** пост и откройте снова — проверьте, что данные загружаются из БД
7. Проверьте timestamp — должен показывать время последнего пересчета, а не текущее время

### Переиспользование паттерна
Этот паттерн можно использовать в других UI компонентах с похожими проблемами:
```typescript
// 1. Локальное состояние для UI
const [localValue, setLocalValue] = useState(externalValue);

// 2. Отложенный коммит
const [pendingCommit, setPendingCommit] = useState(null);

// 3. Refs для dispatch и путей
const dispatchRef = useRef(dispatch);

// 4. Отдельный useEffect для коммита
useEffect(() => {
  if (!pendingCommit) return;
  dispatchRef.current?.({ type: 'UPDATE', path, value: pendingCommit });
  setPendingCommit(null);
}, [pendingCommit]);

// 5. Изменения через setPendingCommit вместо прямого dispatch
const handleChange = (value) => {
  setLocalValue(value);
  setPendingCommit(value);
};
```

---

## Следующие шаги
- [x] Настроить Cloudflare R2 для хранения медиа
- [x] Добавить AI summary feature
- [x] Интерфейс с закладками
- [x] Генерация slug из названия
- [x] Система черновиков
- [x] Определить архитектуру локализации
- [x] Исправить бесконечные циклы в SEO компонентах
- [ ] Обновить AI компоненты для работы с переводами
- [ ] Настроить фронтенд ASTRO для работы с API переводов
