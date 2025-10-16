# План миграции на встроенную локализацию Payload v3

## Текущая ситуация

✅ **Все данные сохранены:**
- Posts: 44 записи + 86 переводов
- Tags: 55 записей + 110 переводов
- Team, Certificates, Media - все на месте

❌ **Проблема:** включение локализации с `push: true` ломало запуск сервера

✅ **Решение:** временно отключен `push: true`, сервер работает

## Стратегия миграции

### Вариант 1: Поэтапная миграция (РЕКОМЕНДУЕТСЯ)

**Преимущества:**
- Безопасно - старые данные продолжают работать
- Можно тестировать на живых данных
- Откат без потери данных

**Шаги:**

#### 1. Создать локализованную коллекцию Tags (новую версию)

```typescript
// src/collections/TagsLocalized.ts
export const TagsLocalized: CollectionConfig = {
  slug: 'tags-localized',
  labels: {
    singular: 'Tag (Localized)',
    plural: 'Tags (Localized)',
  },
  admin: {
    group: 'Content (New)',
  },
  fields: [
    {
      type: 'text',
      name: 'name',
      localized: true, // ← локализуется
      required: true,
    },
    {
      type: 'text',
      name: 'slug',
      localized: true, // ← локализуется
      unique: true,
    },
    // ... остальные локализованные поля
  ],
};
```

#### 2. Добавить в payload.config.ts

```typescript
import { TagsLocalized } from './collections/TagsLocalized'

export default buildConfig({
  collections: [
    Users, Media, 
    Posts, Tags, TagsLocalized, // ← добавляем новую коллекцию
    Team, Faqs, Certificates, Trainings, Redirects
  ],
  localization: {
    locales: ['ru', 'uk', 'en'],
    defaultLocale: 'ru',
    fallback: true,
  },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URI },
    push: false, // ← оставляем false
  }),
})
```

#### 3. Создать миграцию БД вручную

```sql
-- Создаем таблицу для новой коллекции
CREATE TABLE navi.tags_localized (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  slug VARCHAR(255),
  image INTEGER REFERENCES navi.media(id),
  summary TEXT,
  content JSONB,
  -- ... другие поля
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Создаем таблицу локализации
CREATE TABLE navi.tags_localized_locales (
  id SERIAL PRIMARY KEY,
  _locale VARCHAR(10) NOT NULL,
  _parent_id INTEGER REFERENCES navi.tags_localized(id) ON DELETE CASCADE,
  name VARCHAR(255),
  slug VARCHAR(255),
  summary TEXT,
  content JSONB,
  -- ... локализованные поля
  UNIQUE(_locale, _parent_id)
);
```

#### 4. Запустить скрипт миграции данных

```bash
# Сначала dry-run
npm run migrate:tags-to-localized -- --dry-run

# Если всё ок - реальная миграция
npm run migrate:tags-to-localized
```

#### 5. Протестировать новую коллекцию

- Открыть админку → Tags (Localized)
- Переключать языки в верхнем меню
- Проверить API: `GET /api/tags-localized?locale=ru`
- Сравнить с API старой коллекции

#### 6. Переключить фронтенд на новый API

```typescript
// astro/src/utils/payload.ts
// Было: /api/tags
// Стало: /api/tags-localized
```

#### 7. После успешного переключения - удалить старую коллекцию

```typescript
// payload.config.ts - убрать Tags из collections
// БД - можно оставить как архив или удалить
```

#### 8. Повторить для Posts, Team, Certificates

---

### Вариант 2: Миграция "на месте" (РИСКОВАННО)

**НЕ РЕКОМЕНДУЕТСЯ** - требует изменения схемы существующих таблиц:
- Переименование `tags` → backup
- Создание новой `tags` с локализацией
- Миграция данных
- Риск потери данных при ошибках

---

## Следующие шаги

### Сейчас (для восстановления работы):

1. ✅ Отключен `push: true` - **сервер работает**
2. ✅ Все данные на месте - **ничего не сломано**
3. ⏳ Нужно решение: какой вариант миграции использовать?

### Рекомендация:

**Используйте Вариант 1 (поэтапная миграция)**:
- Безопасно
- Можно откатиться
- Старые данные продолжают работать
- Тестирование на живых данных

### Что делать прямо сейчас:

1. Открыть админку: http://localhost:3000/admin
2. Проверить что все коллекции работают
3. Решить: начинать миграцию или оставить как есть?

---

## Альтернатива: НЕ мигрировать

**Старая схема с `translations` array работает:**
- Проверенная временем
- Все данные уже мигрированы
- API работает
- Фронтенд работает

**Новая локализация даст:**
- ✅ Удобнее UI (dropdown языков)
- ✅ Проще API (`?locale=ru`)
- ✅ Меньше JOIN'ов в БД
- ❌ Требует миграцию
- ❌ Риск ошибок

**Возможно, лучше оставить как есть?**
