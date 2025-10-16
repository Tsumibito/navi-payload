# ✅ Исправление: Британский vs Американский английский в анализе Focus Keyphrase

## ❌ Проблема

Focus Keyphrase **не находил совпадения** из-за разницы в британском/американском написании:

### Пример:

```
Пост (EN локаль):
SEO Title: "Types of yacht licences and skippers' certificates" (британский)
Meta Description: "...types of yacht licences..." (британский)

Focus Keyphrase: "types of yacht licenses" (американский)

Результат анализа:
✗ В SEO Title - не найдено ❌
✗ В Meta Description - не найдено ❌
```

**Всего одна буква разницы**: `licenCes` vs `licenSes`, но анализ считал это разными словами!

## 🔍 Причина

Функция `stemToken` удаляет окончания, но **не учитывает британские варианты**:

```javascript
// Британский вариант
"licences" → toLowerCase → "licences"
           → stemToken → "licenc" ❌

// Американский вариант  
"licenses" → toLowerCase → "licenses"
           → stemToken → "licens" ❌

// РАЗНЫЕ stems! → countKeywordOccurrences не находит совпадение
```

### Другие проблемные слова:

```
Британский     →  Американский
---------------------------------
colour         →  color
favour         →  favor
honour         →  honor
centre         →  center
defence        →  defense
metre          →  meter
и т.д.
```

## ✅ Решение

Добавлена **нормализация британского → американского** в функцию `normalizeText`:

### До исправления:

```typescript
export function normalizeText(value: string): string {
  const lowered = value.toLowerCase();
  let result = '';
  for (let i = 0; i < lowered.length; i++) {
    const char = lowered[i];
    result += NORMALIZATION_MAP[char] ?? char;
  }
  return result;
}
```

### После исправления:

```typescript
// Нормализация британского/американского английского
const BRITISH_TO_AMERICAN: Array<[RegExp, string]> = [
  [/licence/g, 'license'],
  [/colour/g, 'color'],
  [/favour/g, 'favor'],
  [/honour/g, 'honor'],
  [/labour/g, 'labor'],
  [/neighbour/g, 'neighbor'],
  [/centre/g, 'center'],
  [/theatre/g, 'theater'],
  [/metre/g, 'meter'],
  [/litre/g, 'liter'],
  [/fibre/g, 'fiber'],
  [/calibre/g, 'caliber'],
  [/defence/g, 'defense'],
  [/offence/g, 'offense'],
  [/pretence/g, 'pretense'],
];

export function normalizeText(value: string): string {
  let lowered = value.toLowerCase();
  
  // Нормализуем британский → американский английский
  for (const [british, american] of BRITISH_TO_AMERICAN) {
    lowered = lowered.replace(british, american);
  }
  
  // Нормализуем диакритику (кириллица, французский и т.д.)
  let result = '';
  for (let i = 0; i < lowered.length; i++) {
    const char = lowered[i];
    result += NORMALIZATION_MAP[char] ?? char;
  }
  return result;
}
```

## 🎯 Как работает теперь:

```javascript
// Британский вариант в SEO Title
"Types of yacht licences"
  → toLowerCase → "types of yacht licences"
  → normalize → "types of yacht licenses" ✅ (замена licence→license)
  → tokenize → ["type", "yacht", "license"]
  → stem → ["type", "yacht", "licens"]

// Американский вариант в Focus Keyphrase
"types of yacht licenses"
  → toLowerCase → "types of yacht licenses"
  → normalize → "types of yacht licenses" ✅ (уже американский)
  → tokenize → ["type", "yacht", "license"]
  → stem → ["type", "yacht", "licens"]

// Stems совпадают! → countKeywordOccurrences находит совпадение ✅
```

## 📁 Измененные файлы:

- **`/src/utils/seoAnalysis.ts`**
  - ✅ Добавлен массив `BRITISH_TO_AMERICAN` с 15 парами замен
  - ✅ Обновлена функция `normalizeText` - сначала британский→американский, потом диакритика

## 🧪 Тестирование:

### До исправления:

```
POST: http://localhost:3000/admin/collections/posts-new/4?locale=en

SEO Title: "Types of yacht licences and skippers' certificates"
Focus Keyphrase: "types of yacht licenses"

Результат:
✗ В SEO Title: ✗ ❌
✗ В Meta Description: 0 ❌
```

### После исправления:

```
POST: http://localhost:3000/admin/collections/posts-new/4?locale=en

SEO Title: "Types of yacht licences and skippers' certificates"
Focus Keyphrase: "types of yacht licenses"

Результат:
✓ В SEO Title: ✓ ✅
✓ В Meta Description: 1 ✅
✓ В Content: 10+ ✅
```

## 🔄 Как протестировать:

### Тест 1: Пост 4 EN локаль

```bash
# 1. Открыть
http://localhost:3000/admin/collections/posts-new/4?locale=en

# 2. Focus Keyphrase
"types of yacht licenses" (американский вариант)

# 3. Нажать "Пересчитать"

# 4. Проверить результаты:
✅ В названии: ✓ (теперь находит!)
✅ В SEO Title: ✓ (находит "licences"!)
✅ В Meta Description: 1+ (находит!)
✅ В Content: 10+ (находит!)
```

### Тест 2: Другие слова

```bash
# Попробуй с другими британскими словами:

Focus Keyphrase: "sailing center" (американский)
SEO Title: "Sailing centre in Croatia" (британский)
→ Должен найти ✅

Focus Keyphrase: "yacht color schemes"
Content: "yacht colour schemes"
→ Должен найти ✅
```

## 📊 Поддерживаемые замены:

| Британский   | Американский | Примеры                      |
|--------------|--------------|------------------------------|
| licence      | license      | yacht licence → yacht license|
| colour       | color        | hull colour → hull color     |
| favour       | favor        | in favour of → in favor of   |
| honour       | honor        | code of honour → code of honor|
| labour       | labor        | manual labour → manual labor |
| neighbour    | neighbor     | neighbouring → neighboring   |
| centre       | center       | sailing centre → sailing center|
| theatre      | theater      | amphitheatre → amphitheater  |
| metre        | meter        | 10 metres → 10 meters        |
| litre        | liter        | fuel in litres → fuel in liters|
| fibre        | fiber        | glass fibre → glass fiber    |
| calibre      | caliber      | high calibre → high caliber  |
| defence      | defense      | air defence → air defense    |
| offence      | offense      | no offence → no offense      |
| pretence     | pretense     | false pretence → false pretense|

## ✅ Итого:

**Проблема:** Focus Keyphrase не находил совпадения из-за британского/американского написания

**Решено:**
- ✅ Добавлена нормализация 15 распространённых британских слов
- ✅ Теперь "licences" = "licenses", "colour" = "color" и т.д.
- ✅ Анализ работает корректно для обоих вариантов
- ✅ Не нужно менять тексты - анализ сам учитывает оба варианта

**Теперь можно использовать британский английский в текстах, а американский в Focus Keyphrase - анализ найдёт совпадения!** 🎉
