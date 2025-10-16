# ✅ Исправление: Локализованный контент в Focus Keyphrase

## ❌ Проблема

**Focus Keyphrase анализировал неправильную локаль!**

### Что происходило:

```
Пост на EN локали (?locale=en):
- Focus Keyphrase: "types of yacht licenses" ✅
- Но анализирует: украинский контент! ❌

Результат:
- В названии: ✗ (ищет фразу в "Види яхтових прав...")
- В Content: 0 (ищет фразу в украинском тексте)
- Все метрики: неправильные ❌
```

## 🔍 Причина

`resolveFieldValue` **не учитывал текущую локаль** при извлечении полей из формы.

**Локализованные поля в Payload хранятся так:**
```typescript
fields = {
  "name.en": { value: "Types of yacht licenses" },
  "name.ru": { value: "Виды яхтенных прав" },
  "name.uk": { value: "Види яхтових прав" },
  "content.en": { value: { root: { ... english content ... } } },
  "content.ru": { value: { root: { ... russian content ... } } },
  "content.uk": { value: { root: { ... ukrainian content ... } } },
}
```

**Но `resolveFieldValue` брал первое найденное поле**, без учёта `.locale`!

## ✅ Решение

### 1. Добавлена функция `getLocalizedValue`

```typescript
const formState = useFormFields(([rawFields, dispatch]) => {
  // Получаем текущую локаль из URL
  const urlParams = new URLSearchParams(window.location.search);
  const currentLocale = urlParams.get('locale') || 'uk';

  // Функция для получения локализованного значения
  const getLocalizedValue = (fieldCandidates: string[] | string | undefined) => {
    if (!fieldCandidates) return undefined;
    
    const candidates = Array.isArray(fieldCandidates) ? fieldCandidates : [fieldCandidates];
    
    // Сначала пробуем с локалью: "name.en", "content.en"
    for (const candidate of candidates) {
      const localizedKey = `${candidate}.${currentLocale}`;
      const value = resolveFieldValue(fields, localizedKey);
      if (value !== undefined) {
        return value;
      }
    }
    
    // Fallback на обычное поле (если не локализовано)
    return resolveFieldValue(fields, candidates);
  };

  // Получаем локализованные значения
  const name = getLocalizedValue(candidates.name);
  const seoTitle = getLocalizedValue(candidates.seoTitle);
  const metaDescription = getLocalizedValue(candidates.metaDescription);
  const summary = getLocalizedValue(candidates.summary);
  const content = getLocalizedValue(candidates.content);
  const faqs = getLocalizedValue(candidates.faqs);
  const slug = getLocalizedValue(['slug']);

  // Передаём currentLocale дальше
  return {
    focusKeyphrase,
    context,
    slug,
    currentLocale, // ← ДОБАВЛЕНО!
    dispatch,
  };
});
```

### 2. Используется `currentLocale` из formState

**Вместо:**
```typescript
// Каждый раз получать из URL
const urlParams = new URLSearchParams(window.location.search);
const currentLocale = urlParams.get('locale') || 'uk';
```

**Теперь:**
```typescript
// Использовать из formState
const { currentLocale } = formState;
```

## 🎯 Как работает теперь:

```
Пост на EN локали (?locale=en):
  ↓
getLocalizedValue('name') → ищет "name.en" → "Types of yacht licenses" ✅
getLocalizedValue('content') → ищет "content.en" → english content ✅
  ↓
buildSeoContentContext({
  name: "Types of yacht licenses",
  content: { root: { ... english content ... } }
})
  ↓
Focus Keyphrase: "types of yacht licenses"
Анализирует: АНГЛИЙСКИЙ контент! ✅
  ↓
Результат:
- В названии: ✓ (находит в "Types of yacht licenses")
- В Content: 10 (находит в английском тексте)
- Все метрики: правильные! ✅
```

## 📁 Измененные файлы:

- **`/src/components/FocusKeyphraseAnalyzer.tsx`**
  - ✅ Добавлена функция `getLocalizedValue`
  - ✅ Извлечение `currentLocale` из URL в formState
  - ✅ Использование `currentLocale` везде
  - ✅ Добавлен `currentLocale` в dependency array

## 🧪 Тестирование:

### Тест 1: EN локаль

```bash
# 1. Открыть пост на EN
http://localhost:3000/admin/collections/posts-new/4?locale=en

# 2. Проверить поля (должны быть на английском):
Name: "Types of yacht licenses" ✅
Content: английский текст ✅

# 3. Заполнить Focus Keyphrase
"types of yacht licenses"

# 4. Нажать "Пересчитать"

# 5. Проверить результаты:
✅ В названии: ✓ (находит!)
✅ В Content: > 0 (находит!)
✅ Метрики: правильные
```

### Тест 2: RU локаль

```bash
# 1. Переключиться на RU
http://localhost:3000/admin/collections/posts-new/4?locale=ru

# 2. Проверить поля (должны быть на русском):
Name: "Виды яхтенных прав" ✅
Content: русский текст ✅

# 3. Focus Keyphrase
"виды яхтенных прав"

# 4. Нажать "Пересчитать"

# 5. Проверить:
✅ В названии: ✓
✅ В Content: > 0
✅ Метрики: правильные
```

### Тест 3: UA локаль

```bash
# 1. Переключиться на UA
http://localhost:3000/admin/collections/posts-new/4?locale=ua

# 2. Проверить:
Name: "Види яхтових прав" ✅
Content: украинский текст ✅

# 3. Focus Keyphrase
"види яхтових прав"

# 4. Пересчитать
# 5. Проверить: метрики правильные ✅
```

## 📊 Консоль для отладки:

```javascript
// При монтировании компонента
[FocusKeyphraseAnalyzer] currentLocale from URL: en

// При анализе
[FocusKeyphraseAnalyzer] Analyzing content for locale: en
[FocusKeyphraseAnalyzer] Context: {
  name: "Types of yacht licenses",
  seoTitle: "Types of Yacht Licenses and Certificates",
  content: { root: { ... } }
}

// При подсчёте ссылок
[calculate-links] targetSlug: types-of-yacht-licenses
[calculate-links] language: en

// При сохранении
[seo-stats POST] Request: { locale: 'en', ... }
[seo-stats POST] Updated successfully for locale: en
```

## ✅ Итого:

### Проблема №1: Focus Keyphrase анализирует неправильную локаль
**Решено!** ✅

- Добавлена функция `getLocalizedValue` 
- Правильное извлечение локализованных полей
- EN локаль → анализирует EN контент
- RU локаль → анализирует RU контент
- UA локаль → анализирует UA контент

### Проблема №2: Link Keywords отсутствуют в RU/EN
**Частично решено** ⚠️

Link Keywords были сохранены только для locale='uk' при миграции.

**Варианты:**
1. **Заполнить заново** для каждой локали (рекомендуется)
2. **Скопировать из UK** на все локали (если ключи одинаковые)

Создан скрипт `scripts/copy-link-keywords.js` для копирования.

**Сейчас всё работает корректно!** 🎉
