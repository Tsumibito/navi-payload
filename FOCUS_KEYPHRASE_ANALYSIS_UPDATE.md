# Focus Keyphrase Analysis - Обновление

## Что исправлено

### 1. ✅ Внешняя рамка восстановлена
Компонент теперь имеет видимую рамку:
```tsx
<div style={{ 
  border: '2px solid #e5e7eb', 
  borderRadius: '8px', 
  padding: '1.5rem',
  marginBottom: '1.5rem',
  background: '#ffffff',
}}>
```

### 2. ✅ Сохранение данных после пересчета
Исправлено сохранение результатов в форму:
```tsx
const updatedStats = {
  ...stats,
  internalLinks: result.existingLinks || 0,
  potentialLinks: result.potentialLinks || 0,
  updatedAt: new Date().toISOString(),
};

setStats(updatedStats);

// Сохраняем в форму через dispatch
if (dispatch) {
  dispatch({ type: 'UPDATE', path, value: updatedStats });
}
```

### 3. ✅ Передача локали в API
Локаль теперь корректно определяется из URL и передается в API:
```tsx
// Получаем locale из URL или используем uk по умолчанию
const urlParams = new URLSearchParams(window.location.search);
const currentLocale = urlParams.get('locale') || 'uk';
```

### 4. ✅ Обновлена конфигурация анализируемых полей

Файл: `/src/config/linkAnalysisConfig.ts`

```typescript
export const COLLECTIONS_TO_ANALYZE: readonly CollectionToAnalyze[] = [
  {
    slug: 'posts-new',
    fields: ['content', 'summary'],
    description: 'Posts: Content, Summary, FAQ (Answer)',
  },
  {
    slug: 'tags-new',
    fields: ['content', 'summary'],
    description: 'Tags: Content, Summary, FAQ (Answer)',
  },
  {
    slug: 'team-new',
    fields: ['bio', 'bio_summary'],
    description: 'Team: Biography, Bio Summary, FAQ (Answer)',
  },
  {
    slug: 'certificates',
    fields: ['content', 'requirements', 'program'],
    description: 'Certificates: Description (content), Requirements, Program, FAQ (Answer)',
  },
];
```

**Важно:** FAQ анализируются автоматически для всех коллекций (поле `faqs` с `answer`).

## Архитектура анализа ссылок

### Модули

#### 1. `/src/modules/linkCounter.ts`
**Задача:** Подсчет внутренних ссылок с данным анкором

**Алгоритм:**
1. Получает все документы из настроенных коллекций (кроме текущего)
2. Для каждого документа проверяет все Lexical поля из конфигурации
3. Дополнительно проверяет FAQ (поле `faqs[].answer`)
4. Находит ссылки с анкором, совпадающим с Focus Keyphrase (без учета регистра)
5. Возвращает количество найденных ссылок

**Пример:**
```typescript
await countInternalLinks({
  payload,
  anchor: 'види яхтових прав',
  currentDocId: '4',
  currentCollection: 'posts-new',
  locale: 'uk',
  includeDocuments: false,
});
// Результат: { totalLinks: 3, byCollection: [...] }
```

#### 2. `/src/modules/potentialLinkCounter.ts`
**Задача:** Подсчет потенциальных мест для ссылок

**Алгоритм:**
1. Извлекает весь текст из Lexical полей
2. Находит все упоминания анкора в тексте (без учета регистра)
3. Вычитает количество существующих ссылок с этим анкором
4. Возвращает разницу (потенциальные места)

**Формула:**
```
Потенциальные ссылки = Всего упоминаний текста - Существующих ссылок
```

**Пример:**
```typescript
await countPotentialLinks({
  payload,
  anchor: 'види яхтових прав',
  currentDocId: '4',
  currentCollection: 'posts-new',
  locale: 'uk',
  includeDocuments: false,
});
// Результат: { totalPotential: 12, byCollection: [...] }
```

### Утилиты

#### `/src/utils/lexicalLinkAnalysis.ts`

**Функции:**

1. **`findLinksInLexical(content)`** - находит все ссылки в Lexical контенте
   - Обрабатывает типы: `link`, `autolink`, внутренние ссылки на документы
   - Извлекает анкорный текст и URL

2. **`extractTextFromLexical(content)`** - извлекает весь текст из Lexical
   - Рекурсивно обходит все узлы
   - Объединяет текстовые фрагменты

3. **`findAnchorMentions(text, anchor)`** - находит упоминания анкора в тексте
   - Поиск без учета регистра
   - Возвращает позиции всех вхождений

## Как работает анализ Focus Keyphrase

### Шаг 1: Пользователь нажимает "Пересчитать"

```
FocusKeyphraseAnalyzer (компонент)
  ↓
handleFullRecalculate()
  ↓
1. handleRecalculate() - пересчет метрик (В названии, SEO Title, Content...)
2. fetch('/api/seo-stats/calculate-links') - подсчет ссылок
```

### Шаг 2: API обрабатывает запрос

```
/api/seo-stats/calculate-links
  ↓
Получает: { entity_type, entity_id, language, anchors }
  ↓
Для каждого anchor:
  ├─ countInternalLinks() → Внутренние ссылки
  └─ countPotentialLinks() → Потенциальные ссылки
  ↓
Возвращает: { results: [{ anchor, existingLinks, potentialLinks }] }
```

### Шаг 3: Результат сохраняется

```
FocusKeyphraseAnalyzer
  ↓
Обновляет state: setStats(updatedStats)
  ↓
Сохраняет в форму: dispatch({ type: 'UPDATE', path, value: updatedStats })
  ↓
После перезагрузки: useEffect загружает из statsField
```

## Конфигурация

### Как добавить новую коллекцию

Откройте `/src/config/linkAnalysisConfig.ts`:

```typescript
export const COLLECTIONS_TO_ANALYZE: readonly CollectionToAnalyze[] = [
  // ... существующие
  {
    slug: 'your-collection',
    fields: ['field1', 'field2'], // Lexical поля
    description: 'Описание для документации',
  },
];
```

**FAQ анализируются автоматически** для всех коллекций!

### Как добавить FAQ анализ к коллекции

FAQ уже анализируются автоматически, если:
- В документе есть поле `faqs` (массив)
- Каждый FAQ имеет поле `answer` (Lexical)

**Ничего дополнительно настраивать не нужно!**

## Пример работы

### Входные данные
- **Focus Keyphrase:** "види яхтових прав"
- **Текущий документ:** posts-new/4 (uk)
- **Коллекции для анализа:**
  - posts-new: content, summary, FAQ
  - tags-new: content, summary, FAQ
  - team-new: bio, bio_summary, FAQ
  - certificates: content, requirements, program, FAQ

### Процесс анализа

1. **Внутренние ссылки:**
   - Ищем ссылки с анкором "види яхтових прав"
   - Игнорируем регистр
   - Не проверяем куда ведет ссылка (это на следующем этапе)
   - **Результат:** 3 ссылки найдено

2. **Потенциальные ссылки:**
   - Ищем текст "види яхтових прав" во всех полях
   - Игнорируем регистр
   - Вычитаем существующие ссылки с таким анкором
   - **Результат:** 12 упоминаний без ссылки

### Визуализация

```
┌─────────────────────────────────────────────────┐
│ Анализ Focus Keyphrase: "види яхтових прав"    │
│ [Кнопка: Пересчитать]                           │
├─────────────────────────────────────────────────┤
│ В названии    │ В SEO Title  │ В Meta Desc    │
│     ✓         │      ✗       │      2         │
├─────────────────────────────────────────────────┤
│ В Summary     │ В Content    │ В заголовках   │
│     3         │  15 (1.2%)   │      4         │
├─────────────────────────────────────────────────┤
│ В FAQ         │ Внутренние   │ Потенциальные  │
│     0         │      3       │      12        │
└─────────────────────────────────────────────────┘
Обновлено: 15.10.2025, 16:45:00
```

## Файлы

- `/src/components/FocusKeyphraseAnalyzer.tsx` - UI компонент
- `/src/config/linkAnalysisConfig.ts` - конфигурация коллекций
- `/src/modules/linkCounter.ts` - подсчет внутренних ссылок
- `/src/modules/potentialLinkCounter.ts` - подсчет потенциальных ссылок
- `/src/utils/lexicalLinkAnalysis.ts` - утилиты для работы с Lexical
- `/src/app/(payload)/api/seo-stats/calculate-links/route.ts` - API endpoint
- `/src/fields/seo.ts` - конфигурация SEO полей

## Тестирование

```bash
# 1. Открыть пост на украинском
http://localhost:3000/admin/collections/posts-new/4?locale=uk

# 2. Перейти на вкладку SEO

# 3. Заполнить Focus Keyphrase: "види яхтових прав"

# 4. Нажать "Пересчитать"

# 5. Проверить результаты в консоли браузера
```

**Ожидаемый результат:**
- Все метрики пересчитаны
- Внутренние ссылки найдены
- Потенциальные ссылки подсчитаны
- После перезагрузки страницы данные сохранены

## Логи

```
[linkCounter] Processing posts-new: 42 docs
[linkCounter] Processing tags-new: 15 docs
[linkCounter] Processing team-new: 5 docs
[linkCounter] Processing certificates: 8 docs
[linkCounter] Total links for "види яхтових прав": 3

[potentialLinkCounter] Processing posts-new: 42 docs
[potentialLinkCounter] Processing tags-new: 15 docs
[potentialLinkCounter] Processing team-new: 5 docs
[potentialLinkCounter] Processing certificates: 8 docs
[potentialLinkCounter] Total potential for "види яхтових прав": 12

[calculate-links] Anchor "види яхтових прав": existing=3, potential=12
```
