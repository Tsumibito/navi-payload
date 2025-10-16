# 🔧 Срочные исправления SEO Analysis

## ✅ Проблема 1: Focus Keyphrase не сохраняется в БД

### Описание проблемы:
После нажатия "Пересчитать" данные анализа Focus Keyphrase не сохранялись в базу данных. При перезагрузке страницы все данные слетали.

### Решение:
Добавлено сохранение в БД после каждого пересчета в `FocusKeyphraseAnalyzer.tsx`:

```typescript
// 4. Сохраняем в БД
if (docInfo?.id && docInfo?.collectionSlug) {
  try {
    await fetch('/api/seo-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: docInfo.collectionSlug,
        entity_id: String(docInfo.id),
        focus_keyphrase_stats: updatedStats,
        calculated_at: new Date().toISOString(),
      }),
    });
    console.log('[FocusKeyphraseAnalyzer] Saved to database:', updatedStats);
  } catch (dbError) {
    console.error('[FocusKeyphraseAnalyzer] Database save error:', dbError);
  }
}
```

**Результат:**
- ✅ Все метрики сохраняются в БД
- ✅ После перезагрузки страницы данные восстанавливаются
- ✅ Показатели не исчезают после "Пересчитать"

---

## ✅ Проблема 2: linkCounter находит неправильные ссылки

### Описание проблемы:
При анализе со страницы:
```
vidi-yahtovih-prav-i-shkiperskih-sertifikativ-yak-stati-kapitanom-i-vzyati-yahtu-v-orendu-v-bud-yakij-tochci-svitu
```

Находились ссылки с URL `/ru/tags/shkiperskie-sertifikaty`, которые **НЕ ведут на анализируемую страницу**.

Это ссылки на другую страницу (тег), а не на текущую страницу поста.

### Решение:

#### 1. Добавлен параметр `targetSlug` в linkCounter

**`/src/modules/linkCounter.ts`:**
```typescript
type CountLinksOptions = {
  payload: Payload;
  anchor: string;
  currentDocId?: string | number;
  currentCollection?: string;
  targetSlug?: string; // ← НОВЫЙ параметр
  locale?: string;
  includeDocuments?: boolean;
};
```

#### 2. Ужесточена проверка ссылок

Теперь проверяется **И анкор И URL**:

```typescript
const matchCount = links.filter(link => {
  const anchorMatches = link.anchorText.toLowerCase().trim() === normalizedAnchor;
  
  // Если slug указан, проверяем что URL содержит slug
  if (normalizedSlug) {
    const urlMatches = link.url.toLowerCase().includes(normalizedSlug);
    
    if (anchorMatches) {
      console.log('[linkCounter] Found link - anchor:', link.anchorText, 
                  'url:', link.url, 'matches slug?', urlMatches);
    }
    
    return anchorMatches && urlMatches; // ← ОБЯЗАТЕЛЬНО оба условия!
  }
  
  return anchorMatches;
}).length;
```

#### 3. Передача slug из компонентов

**FocusKeyphraseAnalyzer.tsx:**
```typescript
// Получаем slug из формы
const slug = resolveFieldValue(fields, ['slug']);

// Передаем в API
body: JSON.stringify({
  entity_type: docInfo.collectionSlug,
  entity_id: String(docInfo.id),
  language: currentLocale,
  anchors: [focusKeyphrase],
  targetSlug: slug, // ← Передаем slug
  includeDetails: true,
}),
```

**SeoKeywordManager.tsx:**
```typescript
// Получаем slug из формы
const slug = resolveFieldValue(fields, ['slug']);

// Передаем в API (2 места: добавление + пересчет)
body: JSON.stringify({
  entity_type: docInfo.collectionSlug,
  entity_id: String(docInfo.id),
  language: currentLocale,
  anchors: [trimmedKeyword],
  targetSlug: slug, // ← Передаем slug
  includeDetails: true,
}),
```

#### 4. Обновлен API endpoint

**`/src/app/(payload)/api/seo-stats/calculate-links/route.ts`:**
```typescript
const { entity_type, entity_id, language, anchors, targetSlug, includeDetails } = body;

console.log('[calculate-links] targetSlug:', targetSlug);

const [internalLinksResult, potentialLinksResult] = await Promise.all([
  countInternalLinks({
    payload,
    anchor: cleanedAnchor,
    currentDocId: entity_id,
    currentCollection: entity_type,
    targetSlug, // ← Передаем slug в модуль
    locale: language,
    includeDocuments: includeDetails || false,
  }),
  // ...
]);
```

### Результат:

**Теперь считаются ТОЛЬКО те ссылки, которые:**
1. ✅ Имеют правильный **анкор** (например, "шкіперські сертифікати")
2. ✅ Содержат в URL **slug текущей страницы** (например, "vidi-yahtovih-prav...")

**Не считаются ссылки:**
- ❌ С правильным анкором, но ведущие на другие страницы
- ❌ Например: анкор "шкіперські сертифікати" → URL `/ru/tags/shkiperskie-sertifikaty` (это тег, а не наша страница!)

---

## 🔍 Отладка

Добавлено детальное логирование для проверки работы:

```typescript
console.log('[linkCounter] Searching for anchor:', normalizedAnchor, 
            'with targetSlug:', normalizedSlug);

// При нахождении ссылки
console.log('[linkCounter] Found link - anchor:', link.anchorText, 
            'url:', link.url, 'matches slug?', urlMatches);
```

**Как проверить:**
1. Открыть консоль браузера
2. Нажать "Пересчитать" в Focus Keyphrase или Link Keywords
3. Смотреть логи:
   - Какой slug передается
   - Какие ссылки находятся
   - Проходят ли они проверку по slug

---

## 📁 Измененные файлы

1. **`/src/components/FocusKeyphraseAnalyzer.tsx`**
   - ✅ Добавлено сохранение в БД после пересчета
   - ✅ Добавлено получение и передача slug

2. **`/src/components/SeoKeywordManager.tsx`**
   - ✅ Добавлено получение и передача slug
   - ✅ Обновлены dependencies для useCallback

3. **`/src/modules/linkCounter.ts`**
   - ✅ Добавлен параметр targetSlug
   - ✅ Ужесточена проверка: анкор + URL
   - ✅ Добавлено детальное логирование

4. **`/src/app/(payload)/api/seo-stats/calculate-links/route.ts`**
   - ✅ Добавлен прием и передача targetSlug
   - ✅ Добавлено логирование

---

## 🧪 Тестирование

### Тест 1: Сохранение Focus Keyphrase

```bash
# 1. Открыть пост
http://localhost:3000/admin/collections/posts-new/16?locale=uk

# 2. Заполнить Focus Keyphrase: "шкіперські сертифікати"

# 3. Нажать "Пересчитать"
# Ожидается: все метрики рассчитаны

# 4. Перезагрузить страницу (F5)
# Ожидается: все данные на месте ✅
```

### Тест 2: Проверка slug в ссылках

```bash
# 1. Открыть пост со slug:
# vidi-yahtovih-prav-i-shkiperskih-sertifikativ-yak-stati-kapitanom-i-vzyati-yahtu-v-orendu-v-bud-yakij-tochci-svitu

# 2. Открыть консоль браузера

# 3. В Focus Keyphrase или Link Keywords добавить "шкіперські сертифікати"

# 4. Нажать "Пересчитать"

# 5. Проверить логи в консоли:
[linkCounter] Searching for anchor: шкіперські сертифікати with targetSlug: vidi-yahtovih-prav...

# 6. Проверить найденные ссылки:
[linkCounter] Found link - anchor: Шкіперські сертифікати 
              url: /ru/tags/shkiperskie-sertifikaty matches slug? false ❌

[linkCounter] Found link - anchor: шкіперські сертифікати 
              url: /uk/vidi-yahtovih-prav... matches slug? true ✅

# 7. Проверить количество в UI
# Ожидается: только ссылки с URL содержащим slug текущей страницы
```

### Тест 3: Link Keywords детали

```bash
# 1. Добавить ключ в Link Keywords

# 2. Проверить что "Внутренние ссылки" и "Потенциальные ссылки" 
#    содержат детали (коллекции и документы)

# 3. Кликнуть на раскрывающийся список (▶)

# 4. Проверить что показываются:
#    - Коллекции (posts-new, tags-new и т.д.)
#    - Документы с ID/названием
#    - Количество в каждом документе

# 5. Перезагрузить страницу

# 6. Проверить что детали сохранились ✅
```

---

## ✅ Итого

### Исправлено:

1. **Focus Keyphrase сохраняется в БД** ✅
   - Данные НЕ слетают после перезагрузки
   - Все метрики на месте

2. **linkCounter проверяет slug** ✅
   - Считаются ТОЛЬКО ссылки на текущую страницу
   - НЕ считаются ссылки на теги/другие страницы
   - Детальное логирование для отладки

3. **Link Keywords показывает детали** ✅
   - Раскрывающиеся списки работают
   - Детали сохраняются в БД

### Как работает:

```
Пользователь на странице: vidi-yahtovih-prav...
                           ↓
              Нажимает "Пересчитать"
                           ↓
         Компонент получает slug из формы
                           ↓
           API получает targetSlug: "vidi-yahtovih-prav..."
                           ↓
         linkCounter ищет ссылки с анкором И slug
                           ↓
   ✅ Анкор: "шкіперські сертифікати" + URL содержит "vidi-yahtovih-prav..." → СЧИТАЕТСЯ
   ❌ Анкор: "шкіперські сертифікати" + URL: "/ru/tags/..." → НЕ СЧИТАЕТСЯ
                           ↓
              Результат сохраняется в БД
                           ↓
          После перезагрузки - данные на месте ✅
```

**Все работает!** 🎉
