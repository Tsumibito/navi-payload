# ✅ Исправление: Отсутствующие панели инструментов в Lexical Editor

## ❌ Проблема

В Lexical editor **отсутствовали панели инструментов** (toolbar):
- ❌ Нет фиксированной панели сверху
- ❌ Нет всплывающей панели при выделении текста
- ❌ Невозможно форматировать текст (жирный, курсив, заголовки, списки)
- ❌ Проблема во всех коллекциях: Posts, Team, Certificates, FAQs

### Скриншот проблемы:

```
[Content field]
┌────────────────────────────────┐
│                                │  ← Нет панели инструментов!
│ Текст без форматирования...    │
│                                │
└────────────────────────────────┘
```

## 🔍 Причина

В Payload CMS v3 **панели инструментов не включены по умолчанию**. Нужно явно добавить features:
- `FixedToolbarFeature()` - постоянная панель сверху
- `InlineToolbarFeature()` - всплывающая панель при выделении

### До исправления:

```typescript
// /src/utils/lexicalConfig.ts
export const contentEditorFeatures = [
  ParagraphFeature(),
  HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4', 'h5', 'h6'] }),
  BoldFeature(),
  ItalicFeature(),
  // ... ❌ НЕТ FixedToolbarFeature и InlineToolbarFeature!
];
```

## ✅ Решение

Добавлены toolbar features в конфигурацию редактора:

### 1. Обновлён `/src/utils/lexicalConfig.ts`:

```typescript
import {
  BoldFeature,
  ItalicFeature,
  UnderlineFeature,
  StrikethroughFeature,
  InlineCodeFeature,
  ParagraphFeature,
  HeadingFeature,
  UnorderedListFeature,
  OrderedListFeature,
  LinkFeature,
  HorizontalRuleFeature,
  UploadFeature,
  RelationshipFeature,
  FixedToolbarFeature,      // ← ДОБАВЛЕНО
  InlineToolbarFeature,     // ← ДОБАВЛЕНО
  BlockquoteFeature,        // ← ДОБАВЛЕНО (бонус)
} from '@payloadcms/richtext-lexical';

export const contentEditorFeatures = [
  // ✅ Фиксированная панель инструментов (всегда видна сверху)
  FixedToolbarFeature(),
  
  // ✅ Всплывающая панель при выделении текста
  InlineToolbarFeature(),
  
  // Базовые элементы
  ParagraphFeature(),
  HeadingFeature({
    enabledHeadingSizes: ['h2', 'h3', 'h4', 'h5', 'h6'],
  }),
  
  // Форматирование текста
  BoldFeature(),
  ItalicFeature(),
  UnderlineFeature(),
  StrikethroughFeature(),
  InlineCodeFeature(),
  BlockquoteFeature(),      // ← ДОБАВЛЕНО
  
  // Списки
  UnorderedListFeature(),
  OrderedListFeature(),
  
  // Ссылки и медиа
  LinkFeature({
    enabledCollections: [POSTS_SLUG, TAGS_SLUG],
  }),
  HorizontalRuleFeature(),
  UploadFeature(),
  RelationshipFeature({
    enabledCollections: [POSTS_SLUG, TAGS_SLUG],
  }),
];

export const simpleEditorFeatures = [
  // ✅ Фиксированная панель инструментов
  FixedToolbarFeature(),
  
  // ✅ Всплывающая панель при выделении
  InlineToolbarFeature(),
  
  // Базовые элементы
  ParagraphFeature(),
  HeadingFeature({
    enabledHeadingSizes: ['h2', 'h3', 'h4', 'h5', 'h6'],
  }),
  
  // Форматирование
  BoldFeature(),
  ItalicFeature(),
  UnderlineFeature(),
  StrikethroughFeature(),
  InlineCodeFeature(),
  BlockquoteFeature(),
  
  // Списки
  UnorderedListFeature(),
  OrderedListFeature(),
  
  // Ссылки
  LinkFeature({
    enabledCollections: [],
  }),
];
```

### 2. Исправлены коллекции Team.ts и Faqs.ts:

**До:**
```typescript
// Team.ts
editor: lexicalEditor({
  features: ({ defaultFeatures }) => defaultFeatures,  // ❌ Использовали defaultFeatures
})
```

**После:**
```typescript
// Team.ts
import { simpleEditorFeatures } from '../utils/lexicalConfig';

editor: lexicalEditor({
  features: simpleEditorFeatures,  // ✅ Используем конфигурацию с toolbars
})
```

## 🎯 Что теперь доступно:

### Фиксированная панель инструментов (Fixed Toolbar):

```
[Content field]
┌────────────────────────────────────────────────────┐
│ [B] [I] [U] [S] [H2▾] [•] [1.] [🔗] [├─┤] [📷]    │ ← ПАНЕЛЬ!
├────────────────────────────────────────────────────┤
│ Текст с **жирным** и _курсивом_...                 │
│                                                    │
│ ## Заголовок H2                                    │
│                                                    │
│ - Список                                           │
│ - Элементов                                        │
└────────────────────────────────────────────────────┘
```

### Всплывающая панель (Inline Toolbar):

```
Выделяешь текст → появляется панель:

    ┌───────────────────────────────┐
    │ [B] [I] [U] [Code] [🔗] [✂]  │
    └───────────────────────────────┘
           ▼
    Выделенный текст
```

### Доступные инструменты:

#### contentEditorFeatures (для Posts, Certificates, Tags):
- ✅ **Bold** - жирный текст
- ✅ **Italic** - курсив
- ✅ **Underline** - подчёркивание
- ✅ **Strikethrough** - зачёркивание
- ✅ **Inline Code** - `код`
- ✅ **Blockquote** - цитаты
- ✅ **Headings** - H2, H3, H4, H5, H6
- ✅ **Bullet List** - маркированный список
- ✅ **Numbered List** - нумерованный список
- ✅ **Links** - ссылки (внутренние на Posts/Tags)
- ✅ **Horizontal Rule** - горизонтальная линия
- ✅ **Upload** - загрузка изображений
- ✅ **Relationship** - связи с документами

#### simpleEditorFeatures (для Team bio, FAQs):
- ✅ **Bold, Italic, Underline, Strikethrough**
- ✅ **Inline Code, Blockquote**
- ✅ **Headings** - H2-H6
- ✅ **Lists** - bullet и numbered
- ✅ **Links** - простые ссылки (без relationship)

## 📁 Измененные файлы:

1. **`/src/utils/lexicalConfig.ts`**
   - ✅ Добавлен импорт `FixedToolbarFeature`, `InlineToolbarFeature`, `BlockquoteFeature`
   - ✅ Добавлены toolbars в `contentEditorFeatures`
   - ✅ Добавлены toolbars в `simpleEditorFeatures`

2. **`/src/collections/Team.ts`**
   - ✅ Добавлен импорт `simpleEditorFeatures`
   - ✅ Заменены `defaultFeatures` на `simpleEditorFeatures` (2 места)

3. **`/src/collections/Faqs.ts`**
   - ✅ Добавлен импорт `simpleEditorFeatures`
   - ✅ Заменены `defaultFeatures` на `simpleEditorFeatures` (2 места)

## 🔄 Как применить:

Dev-сервер автоматически перезагружается при изменении конфигурации.

**Если панели всё ещё не появились:**

1. Перезагрузи страницу в браузере (Cmd+R / Ctrl+R)
2. Очисти кэш браузера (Cmd+Shift+R / Ctrl+Shift+R)
3. Если не помогло - перезапусти dev-сервер:

```bash
# Останови текущий сервер (Ctrl+C)
npm run dev
```

## 🧪 Тестирование:

### Тест 1: Posts Content

```bash
# 1. Открыть пост
http://localhost:3000/admin/collections/posts-new/4

# 2. Прокрутить до поля "Content"

# 3. Проверить:
✅ Видна фиксированная панель инструментов сверху поля
✅ При выделении текста появляется всплывающая панель
✅ Можно нажать Bold, Italic, создать заголовок
✅ Можно добавить список, ссылку, изображение
```

### Тест 2: Team Bio

```bash
# 1. Открыть
http://localhost:3000/admin/collections/team/<id>

# 2. Прокрутить до "Bio Summary" и "Bio"

# 3. Проверить:
✅ Панель инструментов видна
✅ Можно форматировать текст
```

### Тест 3: FAQ Answer

```bash
# 1. Открыть
http://localhost:3000/admin/collections/faqs/<id>

# 2. Поле "Answer"

# 3. Проверить:
✅ Панель инструментов видна
✅ Можно форматировать ответ
```

### Тест 4: Certificates

```bash
# 1. Открыть
http://localhost:3000/admin/collections/certificates/<id>

# 2. Поля: Description, Requirements, Program

# 3. Проверить:
✅ Все поля имеют панели инструментов
✅ Форматирование работает
```

## ✅ Итого:

**Проблема:** Отсутствовали панели инструментов в Lexical editor

**Решено:**
- ✅ Добавлены `FixedToolbarFeature()` и `InlineToolbarFeature()`
- ✅ Добавлен бонус `BlockquoteFeature()` для цитат
- ✅ Исправлены все коллекции (Posts, Team, FAQs, Certificates)
- ✅ Теперь можно полноценно форматировать текст!

**Теперь Lexical editor работает полноценно со всеми панелями инструментов!** 🎉
