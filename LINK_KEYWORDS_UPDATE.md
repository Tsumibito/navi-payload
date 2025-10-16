# Link Keywords & Focus Keyphrase Analysis - Обновление

## Что изменено

### 1. ✅ Focus Keyphrase Analysis - Раскрывающиеся детали

**Внутренние ссылки** и **Потенциальные ссылки** теперь можно развернуть для просмотра деталей:

```typescript
// При клике на метрику показываются:
- Коллекция (posts-new, tags-new, team-new, certificates)
- Количество в коллекции
- Список документов с ID/названием и количеством
```

**Визуализация:**
```
┌────────────────────────────────────────┐
│ ВНУТРЕННИЕ ССЫЛКИ           ▶          │
│           3                            │
├────────────────────────────────────────┤  ← Клик разворачивает
│ posts-new: 2                           │
│   • Морские узлы (1)                   │
│   • Яхтенные тренинги (1)              │
│ tags-new: 1                            │
│   • Навигация (1)                      │
└────────────────────────────────────────┘
```

#### Реализация:

```typescript
// FocusKeyphraseAnalyzer.tsx
const [linkDetails, setLinkDetails] = useState<LinkDetails | null>(null);
const [showInternalDetails, setShowInternalDetails] = useState(false);
const [showPotentialDetails, setShowPotentialDetails] = useState(false);

// Запрос с includeDetails: true
body: JSON.stringify({
  entity_type: docInfo.collectionSlug,
  entity_id: String(docInfo.id),
  language: currentLocale,
  anchors: [focusKeyphrase],
  includeDetails: true, // Запрашиваем детали
}),

// Сохраняем детали
if (result.details) {
  setLinkDetails({
    internalLinks: result.details.internalLinks || [],
    potentialLinks: result.details.potentialLinks || [],
  });
}
```

### 2. ✅ Link Keywords - Переименование и новый алгоритм

#### Переименование:
- **"Ссылок"** → **"Внутренние ссылки"**
- **"Потенциальных"** → **"Потенциальные ссылки"**

#### Новый алгоритм подсчета:

**Используются модули:**
- `/src/modules/linkCounter.ts` - подсчет внутренних ссылок
- `/src/modules/potentialLinkCounter.ts` - подсчет потенциальных ссылок

**Процесс:**

1. **При добавлении нового ключевого слова:**
   ```typescript
   handleSaveKeyword() {
     // 1. Создать entry
     // 2. Рассчитать вхождения в контенте (cachedTotal, cachedHeadings)
     // 3. Подсчитать ссылки через API для ЭТОГО ключа
     // 4. Сохранить
   }
   ```

2. **По кнопке "Пересчет":**
   ```typescript
   handleRecalculate() {
     // 1. Пересчитать вхождения для ВСЕХ ключей
     // 2. Подсчитать ссылки для ВСЕХ ключей (один запрос)
     // 3. Обновить все данные
   }
   ```

### 3. ✅ API - Поддержка детализации

#### Endpoint: `/api/seo-stats/calculate-links`

**Новый параметр:**
```typescript
{
  includeDetails?: boolean; // Если true, возвращаются данные о документах
}
```

**Response с `includeDetails: true`:**
```typescript
{
  results: [
    {
      anchor: "види яхтових прав",
      existingLinks: 3,
      potentialLinks: 12,
      details: {
        internalLinks: [
          {
            collection: "posts-new",
            count: 2,
            documents: [
              { id: "22", title: "Морские узлы", count: 1 },
              { id: "15", title: "Навигация", count: 1 }
            ]
          }
        ],
        potentialLinks: [
          {
            collection: "tags-new",
            count: 5,
            documents: [
              { id: "8", title: "Яхтинг", count: 3 },
              { id: "12", title: "Обучение", count: 2 }
            ]
          }
        ]
      }
    }
  ]
}
```

### 4. ✅ Локализация

**Определение локали из URL:**
```typescript
const urlParams = new URLSearchParams(window.location.search);
const currentLocale = urlParams.get('locale') || 'uk';
```

**Передача в API:**
```typescript
body: JSON.stringify({
  language: currentLocale, // 'uk', 'ru', 'en'
  ...
})
```

## Архитектура

### Компоненты

#### 1. FocusKeyphraseAnalyzer
**Файл:** `/src/components/FocusKeyphraseAnalyzer.tsx`

**Возможности:**
- 9 метрик анализа Focus Keyphrase
- Раскрывающиеся списки для "Внутренние ссылки" и "Потенциальные ссылки"
- Автоматическое сохранение результатов в БД
- Кнопка "Пересчитать" для обновления данных

**Состояние:**
```typescript
const [stats, setStats] = useState<FocusKeyphraseStats>();
const [linkDetails, setLinkDetails] = useState<LinkDetails | null>(null);
const [showInternalDetails, setShowInternalDetails] = useState(false);
const [showPotentialDetails, setShowPotentialDetails] = useState(false);
```

#### 2. SeoKeywordManager
**Файл:** `/src/components/SeoKeywordManager.tsx`

**Обновления:**
- Переименование метрик
- Автоматический пересчет при добавлении ключа
- Использование модулей linkCounter/potentialLinkCounter
- Определение локали из URL

**Процесс добавления ключа:**
```typescript
handleSaveKeyword() {
  1. Валидация (дубликаты, Focus Keyphrase)
  2. Рассчитать вхождения (enrichKeywordEntries)
  3. Подсчитать ссылки (API /calculate-links)
  4. Сохранить entry с полными данными
}
```

**Процесс пересчета всех ключей:**
```typescript
handleRecalculate() {
  1. Пересчитать вхождения для ВСЕХ (enrichKeywordEntries)
  2. Подсчитать ссылки для ВСЕХ (API /calculate-links с массивом)
  3. Обновить все keywords
  4. Сохранить
}
```

### Модули

#### `/src/modules/linkCounter.ts`
**Задача:** Подсчет внутренних ссылок с данным анкором

**Параметры:**
```typescript
{
  payload: Payload;
  anchor: string;
  currentDocId?: string | number; // Исключить текущий документ
  currentCollection?: string;
  locale: string; // 'uk', 'ru', 'en'
  includeDocuments?: boolean; // Детализация
}
```

**Возвращает:**
```typescript
{
  anchor: string;
  totalLinks: number;
  byCollection: Array<{
    collection: string;
    count: number;
    documents?: Array<{
      id: string | number;
      title?: string;
      count: number;
    }>;
  }>;
}
```

#### `/src/modules/potentialLinkCounter.ts`
**Задача:** Подсчет потенциальных мест для ссылок

**Формула:**
```
Потенциальные = Вхождения в текст - Существующие ссылки с анкором
```

**Аналогичная структура** как у linkCounter.

### API

#### `/src/app/(payload)/api/seo-stats/calculate-links/route.ts`

**Изменения:**
- Поддержка `includeDetails` параметра
- Передача `includeDocuments` в модули
- Получение локали из `language` параметра

```typescript
const [internalLinksResult, potentialLinksResult] = await Promise.all([
  countInternalLinks({
    payload,
    anchor: cleanedAnchor,
    currentDocId: entity_id,
    currentCollection: entity_type,
    locale: language, // Используем переданный язык
    includeDocuments: includeDetails || false, // Детализация по запросу
  }),
  countPotentialLinks({
    payload,
    anchor: cleanedAnchor,
    currentDocId: entity_id,
    currentCollection: entity_type,
    locale: language,
    includeDocuments: includeDetails || false,
  }),
]);
```

## Пример использования

### Focus Keyphrase Analysis

```bash
# 1. Открыть пост
http://localhost:3000/admin/collections/posts-new/4?locale=uk

# 2. Перейти на вкладку SEO

# 3. Заполнить Focus Keyphrase: "види яхтових прав"

# 4. Нажать "Пересчитать"

# 5. Кликнуть на "Внутренние ссылки" (▶) для просмотра деталей
```

**Результат:**
```
┌────────────────────────────────────────┐
│ Анализ Focus Keyphrase: "види яхтових прав" │
│ [Пересчитать]                          │
├────────────────────────────────────────┤
│ В названии    │ В SEO Title  │ ...    │
│      ✓        │      ✗       │        │
├────────────────────────────────────────┤
│ Внутренние ▼  │ Потенциальные ▶│      │
│      3        │      12        │      │
│ posts-new: 2  │                │      │
│ • Doc #22 (1) │                │      │
│ • Doc #15 (1) │                │      │
│ tags-new: 1   │                │      │
│ • Doc #8 (1)  │                │      │
└────────────────────────────────────────┘
```

### Link Keywords

```bash
# 1. Открыть пост
http://localhost:3000/admin/collections/posts-new/4?locale=uk

# 2. Перейти на вкладку SEO → Link Keywords

# 3. Нажать "Добавить ключевое слово"

# 4. Ввести: "морська хвороба"

# 5. Нажать "Добавить"
```

**Результат:**
- Автоматически рассчитаны все метрики для нового ключа
- "Внутренние ссылки": 0
- "Потенциальные ссылки": 5
- "Всего вхождений": 3
- "В заголовках": 1

```bash
# 6. Изменить контент или добавить еще ключей

# 7. Нажать "Пересчет"
```

**Результат:**
- Пересчитаны все ключи
- Обновлены все метрики

## Файлы

**Компоненты:**
- `/src/components/FocusKeyphraseAnalyzer.tsx` - анализ Focus Keyphrase с раскрывающимися деталями
- `/src/components/SeoKeywordManager.tsx` - управление Link Keywords с новым алгоритмом

**Модули:**
- `/src/modules/linkCounter.ts` - подсчет внутренних ссылок
- `/src/modules/potentialLinkCounter.ts` - подсчет потенциальных ссылок

**API:**
- `/src/app/(payload)/api/seo-stats/calculate-links/route.ts` - endpoint с поддержкой детализации

**Утилиты:**
- `/src/utils/lexicalLinkAnalysis.ts` - парсинг Lexical контента

**Конфигурация:**
- `/src/config/linkAnalysisConfig.ts` - настройка анализируемых коллекций и полей

## Тестирование

### 1. Focus Keyphrase - Раскрывающиеся списки

```typescript
// Открыть: http://localhost:3000/admin/collections/posts-new/4?locale=uk
// 1. Заполнить Focus Keyphrase
// 2. Нажать "Пересчитать"
// 3. Кликнуть на "Внутренние ссылки" → должен развернуться список
// 4. Кликнуть на "Потенциальные ссылки" → должен развернуться список
// 5. Проверить что показаны: коллекции, документы, количество
```

### 2. Link Keywords - Добавление с автопересчетом

```typescript
// 1. Нажать "Добавить ключевое слово"
// 2. Ввести: "морська хвороба"
// 3. Нажать "Добавить"
// 4. Должен показаться индикатор загрузки
// 5. После завершения - ключ добавлен со всеми метриками
// 6. Проверить в консоли: [SeoKeywordManager] Added and calculated new keyword
```

### 3. Link Keywords - Пересчет всех

```typescript
// 1. Добавить несколько ключей
// 2. Нажать "Пересчет"
// 3. Должен показаться индикатор загрузки
// 4. После завершения - все ключи обновлены
// 5. Проверить время "Последний пересчет" обновилось
```

### 4. Локализация

```typescript
// 1. Открыть UK версию: ?locale=uk
// 2. Заполнить украинскую фразу: "види яхтових прав"
// 3. Пересчитать
// 4. Проверить в консоли: language: 'uk'
// 5. Открыть RU версию: ?locale=ru
// 6. Заполнить русскую фразу: "виды яхтенных прав"
// 7. Пересчитать
// 8. Проверить в консоли: language: 'ru'
```

## Логи

### Focus Keyphrase Analysis
```
[FocusKeyphraseAnalyzer] Processing anchor: "види яхтових прав"
[calculate-links] Processing anchors: ["види яхтових прав"] includeDetails: true
[linkCounter] Processing posts-new: 42 docs
[linkCounter] Total links for "види яхтових прав": 3
[potentialLinkCounter] Total potential for "види яхтових прав": 12
[calculate-links] Anchor "види яхтових прав": existing=3, potential=12
```

### Link Keywords - Добавление
```
[SeoKeywordManager] Adding new keyword: "морська хвороба"
[calculate-links] Processing anchors: ["морська хвороба"] includeDetails: false
[SeoKeywordManager] Added and calculated new keyword: {
  keyword: "морська хвороба",
  linksCount: 0,
  potentialLinksCount: 5,
  cachedTotal: 3,
  cachedHeadings: 1
}
```

### Link Keywords - Пересчет
```
[SeoKeywordManager] Recalculating 3 keywords
[calculate-links] Processing anchors: ["морська хвороба", "навігація", "яхтинг"]
[SeoKeywordManager] Recalculated and saved: {
  keywords: [...],
  statsUpdatedAt: "2025-10-15T14:56:00.000Z"
}
```

## Итого

### Добавлено:
1. ✅ Раскрывающиеся детали в Focus Keyphrase Analysis
2. ✅ Переименование "Ссылок" → "Внутренние ссылки"
3. ✅ Переименование "Потенциальных" → "Потенциальные ссылки"
4. ✅ Автоматический пересчет при добавлении ключа
5. ✅ Использование модулей linkCounter/potentialLinkCounter
6. ✅ Поддержка локализации (uk/ru/en)
7. ✅ API поддержка детализации (includeDetails)

### Улучшено:
1. ✅ UX - можно видеть где именно найдены ссылки
2. ✅ Производительность - пересчет только нового ключа при добавлении
3. ✅ Консистентность - один алгоритм для Focus Keyphrase и Link Keywords
4. ✅ Локализация - корректная работа с UK/RU/EN

**Все работает!** 🎉
