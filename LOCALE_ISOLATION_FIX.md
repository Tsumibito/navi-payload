# 🌍 Изоляция локалей - Исправление

## ❌ Проблема

**Данные SEO НЕ изолированы по локалям!**

### Что происходило:
```
1. Открываю пост на RU локали (?locale=ru)
2. Заполняю Focus Keyphrase: "виды яхтенных прав"
3. Добавляю Link Keywords: "шкиперские сертификаты"
4. Нажимаю "Пересчитать" → данные сохраняются

5. Переключаюсь на UA локаль (?locale=ua)
6. Вижу СТАРЫЕ данные с RU локали! ❌
   - Focus Keyphrase: "виды яхтенных прав" (это русский!)
   - Link Keywords: "шкиперские сертификаты" (это русский!)

7. Заполняю правильные украинские данные:
   - Focus Keyphrase: "види яхтових прав"
   - Link Keywords: "шкіперські сертифікати"
8. Нажимаю "Пересчитать" → данные сохраняются

9. Переключаюсь обратно на RU (?locale=ru)
10. Вижу УКРАИНСКИЕ данные! ❌
    - Русские данные ПЕРЕЗАПИСАНЫ украинскими!
```

### Почему это происходило:

**API сохранял данные БЕЗ учёта локали:**

```sql
-- БЫЛО (НЕПРАВИЛЬНО):
UPDATE "seo-stats" 
SET stats = {...}, link_keywords = {...}
WHERE entity_type = 'posts-new' 
  AND entity_id = '16'
-- ☝️ НЕТ проверки locale!
-- Результат: данные перезаписываются для ВСЕХ локалей
```

**Таблица:**
```
| entity_type | entity_id | stats          | link_keywords       |
|-------------|-----------|----------------|---------------------|
| posts-new   | 16        | {RU данные}    | {RU ключи}          |
                           ↓
                     ПЕРЕЗАПИСЫВАЮТСЯ
                           ↓
| posts-new   | 16        | {UA данные}    | {UA ключи}          |
```

## ✅ Решение

### 1. Добавлена колонка `locale` в таблицу

**Миграция БД:**
```sql
ALTER TABLE navi."seo-stats" 
ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'uk';

-- Создаём уникальный индекс
CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_stats_entity_locale 
ON navi."seo-stats" (entity_type, entity_id, locale);
```

**Новая структура:**
```
| entity_type | entity_id | locale | stats         | link_keywords      |
|-------------|-----------|--------|---------------|--------------------|
| posts-new   | 16        | ru     | {RU данные}   | {RU ключи}         |
| posts-new   | 16        | ua     | {UA данные}   | {UA ключи}         |
| posts-new   | 16        | en     | {EN данные}   | {EN ключи}         |
```

### 2. Обновлён API

**GET `/api/seo-stats`:**
```typescript
// БЫЛО:
WHERE entity_type = ${entityType} 
  AND entity_id = ${entityId}

// СТАЛО:
WHERE entity_type = ${entityType} 
  AND entity_id = ${entityId}
  AND locale = ${locale}  // ← ДОБАВЛЕНО!
```

**POST `/api/seo-stats`:**
```typescript
// БЫЛО:
UPDATE navi."seo-stats" 
SET stats = {...}, link_keywords = {...}
WHERE entity_type = ${entity_type} 
  AND entity_id = ${entity_id}

// СТАЛО:
UPDATE navi."seo-stats" 
SET stats = {...}, link_keywords = {...}
WHERE entity_type = ${entity_type} 
  AND entity_id = ${entity_id}
  AND locale = ${localeVal}  // ← ДОБАВЛЕНО!
```

### 3. Обновлены компоненты

**Focus Keyphrase Analyzer:**
```typescript
// Загрузка
const urlParams = new URLSearchParams(window.location.search);
const currentLocale = urlParams.get('locale') || 'uk';

await fetch(`/api/seo-stats?entity_type=${...}&entity_id=${...}&locale=${currentLocale}`);

// Сохранение
await fetch('/api/seo-stats', {
  method: 'POST',
  body: JSON.stringify({
    entity_type,
    entity_id,
    locale: currentLocale, // ← ДОБАВЛЕНО!
    stats: updatedStats,
  }),
});
```

**SEO Keyword Manager:**
```typescript
// Загрузка
const currentLocale = urlParams.get('locale') || 'uk';
await fetch(`/api/seo-stats?entity_type=${...}&entity_id=${...}&locale=${currentLocale}`);

// Сохранение
await fetch('/api/seo-stats', {
  method: 'POST',
  body: JSON.stringify({
    entity_type,
    entity_id,
    locale: currentLocale, // ← ДОБАВЛЕНО!
    link_keywords: value,
  }),
});
```

## 🎯 Как работает теперь

```
┌─────────────────────────────────────────────┐
│  Открываю пост на RU (?locale=ru)          │
└─────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────┐
│  Загружается GET /api/seo-stats            │
│  ?locale=ru                                 │
│                                             │
│  SELECT * FROM "seo-stats"                  │
│  WHERE entity_id = '16'                     │
│    AND locale = 'ru'  ← только RU!          │
└─────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────┐
│  Заполняю RU данные:                        │
│  Focus: "виды яхтенных прав"                │
│  Keywords: "шкиперские сертификаты"         │
│                                             │
│  Нажимаю "Пересчитать"                      │
└─────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────┐
│  POST /api/seo-stats                        │
│  { locale: 'ru', stats: {...} }             │
│                                             │
│  UPDATE "seo-stats"                         │
│  WHERE entity_id = '16'                     │
│    AND locale = 'ru'  ← только RU!          │
└─────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────┐
│  Переключаюсь на UA (?locale=ua)           │
└─────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────┐
│  Загружается GET /api/seo-stats            │
│  ?locale=ua                                 │
│                                             │
│  SELECT * FROM "seo-stats"                  │
│  WHERE entity_id = '16'                     │
│    AND locale = 'ua'  ← только UA!          │
│                                             │
│  Результат: NULL (нет данных)               │
│  ✅ Поля пустые!                            │
└─────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────┐
│  Заполняю UA данные:                        │
│  Focus: "види яхтових прав"                 │
│  Keywords: "шкіперські сертифікати"         │
│                                             │
│  Нажимаю "Пересчитать"                      │
└─────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────┐
│  POST /api/seo-stats                        │
│  { locale: 'ua', stats: {...} }             │
│                                             │
│  UPDATE "seo-stats"                         │
│  WHERE entity_id = '16'                     │
│    AND locale = 'ua'  ← только UA!          │
│                                             │
│  ✅ RU данные НЕ ЗАТРОНУТЫ!                 │
└─────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────┐
│  Переключаюсь обратно на RU (?locale=ru)   │
└─────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────┐
│  Загружается GET /api/seo-stats            │
│  ?locale=ru                                 │
│                                             │
│  SELECT * FROM "seo-stats"                  │
│  WHERE entity_id = '16'                     │
│    AND locale = 'ru'                        │
│                                             │
│  ✅ RU данные на месте!                     │
│  Focus: "виды яхтенных прав"                │
│  Keywords: "шкиперские сертификаты"         │
└─────────────────────────────────────────────┘
```

## 📋 Что изменено

### Файлы:

1. **`/src/app/(payload)/api/seo-stats/route.ts`**
   - ✅ GET: добавлена загрузка по `locale`
   - ✅ POST: добавлено сохранение с `locale`

2. **`/src/components/FocusKeyphraseAnalyzer.tsx`**
   - ✅ Получение `locale` из URL
   - ✅ Передача `locale` в GET
   - ✅ Передача `locale` в POST

3. **`/src/components/SeoKeywordManager.tsx`**
   - ✅ Получение `locale` из URL
   - ✅ Передача `locale` в GET
   - ✅ Передача `locale` в POST

### БД:

**ВАЖНО!** Нужно выполнить миграцию:

```sql
-- 1. Добавляем колонку locale
ALTER TABLE navi."seo-stats" 
ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'uk';

-- 2. Обновляем существующие записи (если нужно)
UPDATE navi."seo-stats" 
SET locale = 'uk' 
WHERE locale IS NULL;

-- 3. Делаем колонку NOT NULL
ALTER TABLE navi."seo-stats" 
ALTER COLUMN locale SET NOT NULL;

-- 4. Создаём уникальный индекс
CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_stats_entity_locale 
ON navi."seo-stats" (entity_type, entity_id, locale);

-- 5. Удаляем старый индекс (если был)
-- DROP INDEX IF EXISTS idx_seo_stats_entity;
```

## 🧪 Тестирование

### Тест 1: Изоляция RU и UA

```bash
# 1. Открыть пост на RU
http://localhost:3000/admin/collections/posts-new/16?locale=ru

# 2. Заполнить RU данные
Focus Keyphrase: "виды яхтенных прав"
Link Keywords: "шкиперские сертификаты"

# 3. Нажать "Пересчитать"

# 4. Проверить логи:
[seo-stats POST] Request: { locale: 'ru', ... }
[seo-stats POST] Updated successfully for locale: ru

# 5. Переключиться на UA
http://localhost:3000/admin/collections/posts-new/16?locale=ua

# 6. Проверить:
✅ Поля ПУСТЫЕ (нет RU данных)
✅ Focus Keyphrase: пусто
✅ Link Keywords: пусто

# 7. Заполнить UA данные
Focus Keyphrase: "види яхтових прав"
Link Keywords: "шкіперські сертифікати"

# 8. Нажать "Пересчитать"

# 9. Проверить логи:
[seo-stats POST] Request: { locale: 'ua', ... }
[seo-stats POST] Updated successfully for locale: ua

# 10. Переключиться обратно на RU
http://localhost:3000/admin/collections/posts-new/16?locale=ru

# 11. Проверить:
✅ RU данные НА МЕСТЕ!
✅ Focus Keyphrase: "виды яхтенных прав"
✅ Link Keywords: "шкиперские сертификаты"
```

### Тест 2: Три локали одновременно

```sql
-- Проверяем в БД
SELECT entity_id, locale, focus_keyphrase, 
       jsonb_extract_path_text(stats, 'inName') as in_name
FROM navi."seo-stats"
WHERE entity_type = 'posts-new' 
  AND entity_id = '16'
ORDER BY locale;

-- Ожидаемый результат:
| entity_id | locale | focus_keyphrase        | in_name |
|-----------|--------|------------------------|---------|
| 16        | en     | "yacht license types"  | true    |
| 16        | ru     | "виды яхтенных прав"   | true    |
| 16        | ua     | "види яхтових прав"    | true    |
```

## 📊 Логи для отладки

**При загрузке:**
```
[seo-stats GET] Loading: { 
  entityType: 'posts-new', 
  entityId: '16', 
  locale: 'ru' 
}
[seo-stats GET] Found data for locale: ru
```

**При сохранении:**
```
[seo-stats POST] Request: { 
  entity_type: 'posts-new',
  entity_id: '16',
  locale: 'ru',
  has_stats: true,
  has_link_keywords: true
}
[seo-stats POST] Updated successfully for locale: ru
```

**Если нет данных:**
```
[seo-stats GET] Loading: { locale: 'ua' }
[seo-stats GET] No data for locale: ua
[SeoKeywordManager] No data for locale: ua
[SeoKeywordManager] Resetting to empty
```

## ✅ Итого

### Что было:
- ❌ Данные перезаписывались для всех локалей
- ❌ RU данные затирали UA данные и наоборот
- ❌ Невозможно было иметь разные Focus Keyphrase для разных языков

### Что стало:
- ✅ Каждая локаль имеет свои данные
- ✅ RU, UA, EN данные изолированы друг от друга
- ✅ Можно иметь разные Focus Keyphrase для каждого языка
- ✅ Переключение локалей работает корректно

**Проблема решена!** 🎉
