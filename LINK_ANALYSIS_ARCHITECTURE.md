# Архитектура анализа ссылок

## Дата: 15 октября 2025

### Обзор

Система анализа ссылок состоит из модульных компонентов для подсчета:
1. **Внутренних ссылок** - ссылки с данным анкором
2. **Потенциальных ссылок** - упоминания анкора БЕЗ ссылки

### Архитектура

```
┌─────────────────────────────────────────────┐
│          Конфигурация коллекций             │
│    /src/config/linkAnalysisConfig.ts        │
│   - Какие коллекции анализировать           │
│   - Какие поля проверять                    │
└──────────────────┬──────────────────────────┘
                   │
    ┌──────────────┴──────────────┐
    │                             │
    ▼                             ▼
┌────────────────────┐   ┌────────────────────┐
│  Link Counter      │   │ Potential Counter  │
│ /src/modules/      │   │ /src/modules/      │
│  linkCounter.ts    │   │ potentialLink...ts │
│                    │   │                    │
│ - Ищет ссылки      │   │ - Ищет упоминания  │
│ - Проверяет анкор  │   │ - Без ссылки       │
│ - Возвращает count │   │ - Возвращает count │
└────────────────────┘   └────────────────────┘
           │                        │
           └────────┬───────────────┘
                    ▼
         ┌──────────────────────┐
         │      API Route       │
         │  /api/seo-stats/     │
         │  calculate-links     │
         │                      │
         │ - POST endpoint      │
         │ - Promise.all        │
         │ - Parallel execution │
         └──────────────────────┘
```

### Файлы и их назначение

#### 1. Конфигурация

**`/src/config/linkAnalysisConfig.ts`**

Определяет какие коллекции и поля участвуют в анализе:

```typescript
export const COLLECTIONS_TO_ANALYZE = [
  {
    slug: 'posts-new',
    fields: ['content', 'summary'],
    description: 'Посты блога',
  },
  // ... другие коллекции
];
```

**Как изменить:**
1. Добавить новую коллекцию
2. Изменить список полей
3. Убрать коллекцию из анализа

#### 2. Модуль подсчета внутренних ссылок

**`/src/modules/linkCounter.ts`**

Экспортирует: `countInternalLinks(options)`

**Что делает:**
1. Получает документы из коллекций (исключая текущий)
2. Для каждого Lexical поля:
   - Находит все ссылки (`findLinksInLexical`)
   - Проверяет совпадение анкора
   - Подсчитывает количество
3. Возвращает:
   - `totalLinks` - общее количество
   - `byCollection` - разбивка по коллекциям
   - `documents` - список документов (опционально)

**Пример использования:**
```typescript
const result = await countInternalLinks({
  payload,
  anchor: 'морская болезнь',
  currentDocId: '22',
  currentCollection: 'posts-new',
  locale: 'none',
  includeDocuments: true, // Для детализации
});

// result.totalLinks === 15
// result.byCollection[0].collection === 'posts-new'
// result.byCollection[0].count === 10
```

#### 3. Модуль подсчета потенциальных ссылок

**`/src/modules/potentialLinkCounter.ts`**

Экспортирует: `countPotentialLinks(options)`

**Что делает:**
1. Получает документы из коллекций (исключая текущий)
2. Для каждого Lexical поля:
   - Извлекает весь текст (`extractTextFromLexical`)
   - Находит упоминания анкора (`findAnchorMentions`)
   - Находит существующие ссылки с анкором
   - **Potential = Упоминания - Существующие ссылки**
3. Возвращает аналогично `linkCounter`

**Алгоритм:**
```
Текст: "морская болезнь может быть морская болезнь опасна"
Анкор: "морская болезнь"

Упоминаний = 2
Существующих ссылок с анкором = 0
Потенциальных = 2 - 0 = 2 ✅
```

#### 4. API Endpoint

**`/src/app/(payload)/api/seo-stats/calculate-links/route.ts`**

**POST `/api/seo-stats/calculate-links`**

**Request:**
```json
{
  "entity_type": "posts-new",
  "entity_id": "22",
  "language": "ru",
  "anchors": ["морская болезнь", "яхтинг"]
}
```

**Response:**
```json
{
  "results": [
    {
      "anchor": "морская болезнь",
      "existingLinks": 3,
      "potentialLinks": 12,
      "details": {
        "internalLinks": [
          { "collection": "posts-new", "count": 2 },
          { "collection": "tags-new", "count": 1 }
        ],
        "potentialLinks": [
          { "collection": "posts-new", "count": 10 },
          { "collection": "certificates", "count": 2 }
        ]
      }
    }
  ]
}
```

**Логика:**
1. Валидация параметров
2. Для каждого анкора:
   - Очистка от лишних символов
   - Параллельный вызов `countInternalLinks` и `countPotentialLinks`
   - Агрегация результатов
3. Возврат JSON

### Утилиты

**`/src/utils/lexicalLinkAnalysis.ts`**

Низкоуровневые функции для работы с Lexical:

- `findLinksInLexical(content)` - находит все ссылки
- `extractTextFromLexical(content)` - извлекает весь текст
- `findAnchorMentions(text, anchor)` - находит упоминания
- `countExistingLinks(links, anchor)` - подсчитывает ссылки (упрощенная версия)
- `countPotentialLinks(content, anchor, existingCount)` - подсчитывает потенциальные

### Очистка данных

**`/scripts/cleanup-link-keywords-locales.js`**

Скрипт для очистки существующих данных в БД от JSON-артефактов.

**Что чистит:**
- `{"keyword"` → `keyword`
- `\"keyword\"` → `keyword`
- `[keyword]` → `keyword`

**Запуск:**
```bash
node scripts/cleanup-link-keywords-locales.js
```

**Результат:**
- Обходит все локализованные таблицы (`posts_new_locales`, `tags_new_locales`, ...)
- Парсит CSV формат PostgreSQL arrays
- Применяет агрессивную очистку
- Обновляет записи

### Производительность

**Оптимизации:**
1. **Параллельное выполнение** - `Promise.all([linkCounter, potentialCounter])`
2. **Минимальная глубина** - `depth: 0` при запросах
3. **Без локализации** - `locale: 'none'` для скорости
4. **Опциональная детализация** - `includeDocuments: false` по умолчанию

**Время выполнения:**
- ~100 документов = ~5-10 секунд
- ~1000 документов = ~30-60 секунд

### TODO

- [ ] Добавить кэширование результатов (Redis/Memory)
- [ ] Индексы БД для Lexical полей
- [ ] Поддержка локализованного анализа (ru/uk/en отдельно)
- [ ] UI для просмотра детализации (какие страницы, где именно)
- [ ] Webhook для фонового пересчета
- [ ] Rate limiting для API

### Примеры использования

**Добавить новую коллекцию:**

```typescript
// /src/config/linkAnalysisConfig.ts
export const COLLECTIONS_TO_ANALYZE = [
  // ... existing
  {
    slug: 'faqs',
    fields: ['answer'],
    description: 'FAQ answers',
  },
];
```

**Изменить алгоритм подсчета:**

```typescript
// /src/modules/potentialLinkCounter.ts
// Пример: учитывать регистр

function countPotentialInContent(content: unknown, anchor: string): number {
  const text = extractTextFromLexical(content);
  
  // Без toLowerCase() - точное совпадение
  const mentions = text.split(anchor).length - 1;
  
  // ... rest
}
```

**Получить детализацию:**

```typescript
const result = await countInternalLinks({
  payload,
  anchor: 'яхтинг',
  includeDocuments: true, // ✅ Включить детализацию
});

console.log(result.byCollection[0].documents);
// [
//   { id: '22', title: 'Что такое яхтинг', count: 5 },
//   { id: '45', title: 'История яхтинга', count: 2 },
// ]
```

### Диагностика

**Логи:**
```
[linkCounter] Processing posts-new: 44 docs
[potentialLinkCounter] Processing posts-new: 44 docs
[calculate-links] Anchor "морская болезнь": existing=3, potential=12
```

**Если ошибка:**
1. Проверить конфигурацию коллекций
2. Проверить существование полей
3. Проверить формат Lexical данных
4. Посмотреть логи модулей

### Тестирование

```bash
# Очистка данных
node scripts/cleanup-link-keywords-locales.js

# Перезапуск сервера
pnpm dev

# Тест API
curl -X POST http://localhost:3000/api/seo-stats/calculate-links \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "posts-new",
    "entity_id": "22",
    "language": "ru",
    "anchors": ["морская болезнь"]
  }'
```
