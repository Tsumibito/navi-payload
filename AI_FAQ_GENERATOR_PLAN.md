# 🤖 AI FAQ Generator - План реализации

## ✅ Что уже сделано:

### 1. Расширен Lexical Toolbar
- ✅ Добавлены: `AlignFeature`, `IndentFeature`, `ChecklistFeature`
- ✅ Toolbar теперь включает:
  - Bold, Italic, Underline, Strikethrough
  - Headings (H2-H6)
  - Align (left, center, right, justify)
  - Indent (Tab / Shift+Tab)
  - Lists: bullet, numbered, **checklist** ✅
  - Links, Images, Blockquotes

**Undo/Redo работают автоматически** через Ctrl+Z / Ctrl+Shift+Z!

### 2. DataForSEO API Endpoint
**Файл:** `/src/app/(payload)/api/dataforseo/route.ts`

**Эндпоинты:**
```bash
POST /api/dataforseo

Body:
{
  "type": "keyword_ideas",  // или "people_also_ask"
  "keyword": "types of yacht licenses",
  "language_code": "en",
  "location": "United States"  // опционально
}
```

**Функции:**
- ✅ Keyword Ideas → связанные вопросы
- ✅ Google SERP → People Also Ask
- ✅ Автоматическая фильтрация вопросов
- ✅ Поддержка локалей: RU, UK, EN, FR
- ✅ Автоопределение локации по языку

**Пример ответа:**
```json
{
  "type": "keyword_ideas",
  "keyword": "types of yacht licenses",
  "language_code": "en",
  "questions": [
    "what are the different types of yacht licenses?",
    "how to get a yacht license?",
    "which yacht license do I need?"
  ]
}
```

### 3. AI Generation API Endpoint
**Файл:** `/src/app/(payload)/api/generate-faq/route.ts`

**Эндпоинт:**
```bash
POST /api/generate-faq

Body:
{
  "postTitle": "Types of yacht licenses",
  "postContent": "{...lexical json...}",
  "postSummary": "...",
  "existingFaqs": [{question: "...", answer: "..."}],
  "focusKeyphrase": "types of yacht licenses",
  "linkKeywords": ["skipper certificate", "captain license"],
  "suggestedQuestions": ["what is a yacht license?", ...],
  "userPrompt": "Generate FAQ about yacht licensing requirements",
  "count": 5,
  "locale": "en"
}
```

**Функции:**
- ✅ Получает контекст поста (title, content, summary, faqs)
- ✅ Использует SEO данные (focus keyphrase, link keywords)
- ✅ Учитывает вопросы из DataForSEO
- ✅ Генерирует через OpenRouter (Claude 3.5 Sonnet)
- ✅ Извлекает текст из Lexical JSON
- ✅ Возвращает структурированный JSON

**Пример ответа:**
```json
{
  "success": true,
  "faqs": [
    {
      "question": "What are the main types of yacht licenses?",
      "answer": "There are several types of yacht licenses..."
    },
    ...
  ]
}
```

---

## 📋 TODO: Что нужно доделать

### 4. API для сохранения FAQ с автопереводом
**Файл (создать):** `/src/app/(payload)/api/save-faqs/route.ts`

**Функционал:**
1. Принимает массив FAQ на одном языке
2. Переводит на другие локали (RU, UK, EN) через OpenRouter
3. Создаёт записи в коллекции `faqs` (или `posts-new.faqs`)
4. Связывает с постом

**Эндпоинт:**
```bash
POST /api/save-faqs

Body:
{
  "postId": "4",
  "locale": "en",  // исходная локаль
  "faqs": [
    {"question": "What is...", "answer": "..."},
    ...
  ],
  "autoTranslate": true  // перевести на RU, UK
}
```

**Алгоритм:**
```typescript
async function saveFAQsWithTranslation(params) {
  const { postId, locale, faqs, autoTranslate } = params;
  
  // 1. Сохраняем оригинальные FAQ (на исходной локали)
  for (const faq of faqs) {
    await payload.create({
      collection: 'faqs',
      data: {
        question: faq.question,
        answer: faq.answer,
        // Связь с постом (если нужно)
        relatedPost: postId,
      },
      locale, // EN, RU, или UK
    });
  }
  
  // 2. Если autoTranslate = true → переводим на другие локали
  if (autoTranslate) {
    const targetLocales = ['ru', 'uk', 'en'].filter(l => l !== locale);
    
    for (const targetLocale of targetLocales) {
      const translatedFaqs = await translateFAQs(faqs, locale, targetLocale);
      
      // Сохраняем переведённые FAQ
      for (const faq of translatedFaqs) {
        await payload.create({
          collection: 'faqs',
          data: {
            question: faq.question,
            answer: faq.answer,
            relatedPost: postId,
          },
          locale: targetLocale,
        });
      }
    }
  }
  
  return { success: true, count: faqs.length };
}

async function translateFAQs(faqs, fromLocale, toLocale) {
  // Вызов OpenRouter для перевода
  const prompt = `Translate the following FAQ items from ${fromLocale} to ${toLocale}...`;
  // ...
  return translatedFaqs;
}
```

---

### 5. React компонент: AI FAQ Generator Dialog
**Файл (создать):** `/src/components/AIFaqGenerator.tsx`

**UI:**
```
┌─────────────────────────────────────────────────┐
│  🤖 AI FAQ Generator                    [✕]     │
├─────────────────────────────────────────────────┤
│                                                 │
│  📝 Prompt:                                     │
│  ┌───────────────────────────────────────────┐ │
│  │ Generate FAQ about yacht licensing...     │ │
│  │                                           │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  Count: [5 ▾]     [Generate FAQs] 🚀           │
│                                                 │
├─────────────────────────────────────────────────┤
│  📊 Preview:                                    │
│                                                 │
│  Q: What are the types of yacht licenses?      │
│  A: There are several types...                 │
│     [✓ Accept] [✗ Reject] [✎ Edit]            │
│                                                 │
│  Q: How to get a yacht license?                │
│  A: To obtain a yacht license...               │
│     [✓ Accept] [✗ Reject] [✎ Edit]            │
│                                                 │
├─────────────────────────────────────────────────┤
│  💬 Feedback to AI:                             │
│  ┌───────────────────────────────────────────┐ │
│  │ Make answers shorter...                   │ │
│  └───────────────────────────────────────────┘ │
│  [Regenerate with feedback] 🔄                 │
│                                                 │
├─────────────────────────────────────────────────┤
│            [Cancel] [Save All FAQs] ✅         │
└─────────────────────────────────────────────────┘
```

**Workflow:**
1. Пользователь нажимает "Generate FAQ" в посте
2. Открывается диалог
3. Вводит промпт ("Generate FAQ about...")
4. Нажимает "Generate FAQs" 🚀
5. **Backend:**
   - Получает контекст поста (title, content, existing FAQs, SEO)
   - Вызывает DataForSEO → получает suggested questions
   - Вызывает `/api/generate-faq` → генерирует ответы
6. **Frontend:**
   - Показывает preview FAQ
   - Пользователь может: Accept / Reject / Edit каждый FAQ
   - Или дать feedback и нажать "Regenerate"
7. Нажимает "Save All FAQs" ✅
8. **Backend:**
   - Вызывает `/api/save-faqs`
   - Сохраняет в `faqs` коллекцию
   - Автоматически переводит на RU, UK
9. Диалог закрывается
10. FAQ появляются в посте

**State Management:**
```typescript
const [step, setStep] = useState<'prompt' | 'preview' | 'feedback'>('prompt');
const [prompt, setPrompt] = useState('');
const [generatedFaqs, setGeneratedFaqs] = useState<FAQItem[]>([]);
const [acceptedFaqs, setAcceptedFaqs] = useState<Set<number>>(new Set());
const [feedback, setFeedback] = useState('');
const [loading, setLoading] = useState(false);
```

---

### 6. Кнопка в Posts Collection
**Файл (изменить):** `/src/content/Posts.ts` (или `/src/collections/Posts.ts`)

**Добавить custom component в admin:**
```typescript
import { AIFaqGeneratorButton } from '../components/AIFaqGeneratorButton';

export const Posts: CollectionConfig = {
  slug: 'posts-new',
  admin: {
    components: {
      views: {
        Edit: {
          Default: {
            actions: [AIFaqGeneratorButton],
          },
        },
      },
    },
  },
  // ...
};
```

**Компонент кнопки:**
```tsx
// /src/components/AIFaqGeneratorButton.tsx
'use client';
import { useDocumentInfo } from '@payloadcms/ui';
import { useState } from 'react';
import { AIFaqGeneratorDialog } from './AIFaqGeneratorDialog';

export const AIFaqGeneratorButton = () => {
  const [open, setOpen] = useState(false);
  const docInfo = useDocumentInfo();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn btn--style-secondary"
      >
        🤖 Generate FAQ with AI
      </button>
      
      {open && (
        <AIFaqGeneratorDialog
          postId={docInfo.id}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};
```

---

## 🎯 Полный workflow (end-to-end)

1. **Открываем пост:**
   ```
   http://localhost:3000/admin/collections/posts-new/4?locale=en
   ```

2. **Нажимаем кнопку "🤖 Generate FAQ with AI"**

3. **В диалоге вводим:**
   ```
   Prompt: "Generate 5 FAQ about yacht licensing requirements for beginners"
   Count: 5
   ```

4. **Нажимаем "Generate"**
   - ⏳ Loading... (5-10 сек)

5. **Backend (автоматически):**
   ```
   1. Получает:
      - Post title: "Types of yacht licenses"
      - Content: "There are several types..."
      - Existing FAQs: 3 штуки
      - Focus Keyphrase: "types of yacht licenses"
      - Link Keywords: ["skipper certificate", "ISSA certification"]
   
   2. Вызывает DataForSEO:
      POST /api/dataforseo
      → Получает 15 suggested questions
   
   3. Вызывает OpenRouter:
      POST /api/generate-faq
      → Генерирует 5 FAQ с ответами
   ```

6. **Frontend показывает preview:**
   ```
   ✅ Q: What types of yacht licenses exist?
      A: There are several main types of yacht licenses:
         RYA (Royal Yachting Association), ISSA...
      [✓ Accept] [✗ Reject] [✎ Edit]
   
   ✅ Q: Do I need a license to charter a yacht?
      A: Yes, most charter companies require...
      [✓ Accept] [✗ Reject] [✎ Edit]
   
   ... (5 total)
   ```

7. **Пользователь редактирует (опционально):**
   - Нажимает [✎ Edit] на FAQ #2
   - Исправляет ответ
   - Сохраняет

8. **Или даёт feedback:**
   ```
   Feedback: "Make answers shorter, max 150 words"
   [Regenerate] 🔄
   
   → Backend снова вызывает OpenRouter с feedback
   → Показывает новые FAQ
   ```

9. **Нажимаем "Save All FAQs" ✅**

10. **Backend:**
    ```
    POST /api/save-faqs
    {
      "postId": "4",
      "locale": "en",
      "faqs": [...5 accepted faqs...],
      "autoTranslate": true
    }
    
    → Сохраняет 5 FAQ в EN локали
    → Переводит на RU
    → Сохраняет 5 FAQ в RU локали
    → Переводит на UK
    → Сохраняет 5 FAQ в UK локали
    
    Total: 15 новых FAQ записей
    ```

11. **Диалог закрывается**

12. **FAQ появляются в посте** (в FAQs array field)

---

## 🔧 Переменные окружения

Добавь в `.env`:

```bash
# DataForSEO
DATAFORSEO_API_KEY=your_key_here
DATAFORSEO_LOGIN=api-user

# OpenRouter (уже есть)
OPENROUTER_TOKEN=sk-or-v1-...
```

---

## 📝 Следующие шаги:

### Шаг 1: Создать API `/api/save-faqs`
```bash
# Создать файл:
/src/app/(payload)/api/save-faqs/route.ts

# Функции:
- saveFAQs(postId, locale, faqs)
- translateFAQs(faqs, fromLocale, toLocale) // через OpenRouter
- linkFAQsToPost(postId, faqIds) // если нужно
```

### Шаг 2: Создать React компоненты
```bash
# Создать:
/src/components/AIFaqGeneratorDialog.tsx
/src/components/AIFaqGeneratorButton.tsx
/src/components/FAQPreviewItem.tsx

# Использовать Payload UI компоненты:
import { Modal, Button, TextArea, FieldLabel } from '@payloadcms/ui';
```

### Шаг 3: Интегрировать в Posts
```typescript
// В /src/content/Posts.ts
admin: {
  components: {
    views: {
      Edit: {
        Default: {
          actions: [AIFaqGeneratorButton],
        },
      },
    },
  },
}
```

### Шаг 4: Тестирование
```bash
1. Открыть пост
2. Нажать "Generate FAQ"
3. Ввести промпт
4. Проверить preview
5. Сохранить
6. Проверить что FAQ созданы в EN, RU, UK
```

---

## 💡 Улучшения (опционально):

1. **Кэширование DataForSEO запросов** (expensive API)
2. **История генераций** (сохранять что генерировали)
3. **Batch processing** (генерировать для нескольких постов)
4. **Custom prompts templates** (шаблоны промптов)
5. **A/B testing** (разные варианты ответов)

---

## ✅ Резюме

**Что готово:**
- ✅ Lexical Toolbar расширен (align, indent, checklist)
- ✅ DataForSEO API (`/api/dataforseo`)
- ✅ AI Generation API (`/api/generate-faq`)

**Что нужно доделать:**
- 📝 Save FAQs API с автопереводом
- 📝 React компоненты (Dialog, Button)
- 📝 Интеграция в Posts admin

**Время на реализацию:** ~4-6 часов

**Технологии:**
- DataForSEO (keyword research, PAA)
- OpenRouter (Claude 3.5 Sonnet)
- Payload CMS (API, collections)
- React (UI компоненты)
- Next.js (API routes)

Готов продолжить! Что делаем дальше? 🚀
