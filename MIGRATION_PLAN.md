# План миграции на нативную локализацию Payload

## ✅ Выполнено

### Tags → TagsNew
- **Статус**: ✅ Завершено
- **Записей**: 55/55
- **Изображения**: ✅ Мигрированы (Featured + OG)
- **Переводы**: ✅ RU/UK/EN
- **Дополнительно**: добавлено поле `seo.link_keywords`

---

## 📋 Очередь миграции

### 1. Posts → PostsNew (Приоритет: ВЫСОКИЙ)
- **Записей**: 44
- **Сложность**: Средняя
- **Локализуемые поля**:
  - `name` (title)
  - `slug`
  - `summary`
  - `content` (richText)
  - `seo.title`
  - `seo.meta_description`
  - `seo.focus_keyphrase`
  - `seo.link_keywords`

- **Общие поля** (не локализуются):
  - `image` (featured)
  - `seo.og_image`
  - `seo.no_index`, `seo.no_follow`
  - `socialImages.thumbnail`, `socialImages.image16x9`, `socialImages.image5x4`
  - `featured` (boolean)
  - `published_at` (date)
  - `author` (relationship → team)
  - `tags` (relationship → tags-new)
  
- **Новое**:
  - Встроить FAQs как массив с локализацией

---

### 2. Team → TeamNew (Приоритет: СРЕДНИЙ)
- **Записей**: 3
- **Сложность**: Низкая
- **Локализуемые поля**:
  - `name`
  - `position` (должность)
  - `bio` (описание)
  
- **Общие поля**:
  - `photo` (upload)
  - `email`
  - `phone`
  - `links` (array of {service, url})
  - `order` (для сортировки)

---

### 3. Certificates → CertificatesNew (Приоритет: СРЕДНИЙ)
- **Записей**: 7
- **Сложность**: Низкая
- **Локализуемые поля**:
  - `name`
  - `description`
  - `requirements`
  - `seo.title`
  - `seo.meta_description`
  - `seo.focus_keyphrase`
  
- **Общие поля**:
  - `code` (уникальный код сертификата)
  - `image`
  - `seo.og_image`
  - `price`
  - `validity_period` (срок действия)

---

### 4. Trainings → TrainingsNew (Приоритет: НИЗКИЙ)
- **Записей**: 0 (пустая коллекция)
- **Статус**: Создать сразу с нативной локализацией
- **Не требует миграции данных**

---

## 🔄 FAQs — новый подход

### Текущая проблема
FAQs сейчас — отдельная коллекция, но по сути это **свойство других страниц**:
- FAQ на странице поста
- FAQ на странице тега  
- FAQ на странице сертификата

### Решение
Встроить FAQs как **поле-массив** в каждую коллекцию:

```typescript
{
  type: 'array',
  name: 'faqs',
  label: 'Frequently Asked Questions',
  fields: [
    {
      type: 'text',
      name: 'question',
      label: 'Question',
      required: true,
      localized: true, // ✅ Переводится на язык страницы
    },
    {
      type: 'richText',
      name: 'answer',
      label: 'Answer',
      required: true,
      localized: true, // ✅ Переводится на язык страницы
      editor: lexicalEditor({
        features: simpleEditorFeatures,
      }),
    },
  ],
  admin: {
    initCollapsed: true,
    description: 'FAQ section for this page (translated)',
  },
}
```

**Преимущества**:
- FAQs переводятся автоматически с родительской страницей
- Не нужна отдельная коллекция
- Проще управление (всё в одном месте)
- SEO-структура сохраняется (JSON-LD можно генерировать из массива)

---

## 🎯 Порядок выполнения

1. **PostsNew** — начать с самой важной коллекции
2. **TeamNew** — быстрая победа (3 записи)
3. **CertificatesNew** — среднего размера (7 записей)
4. **TrainingsNew** — создать сразу правильно (данных нет)
5. **FAQs** — мигрировать связи в массивы родительских коллекций

---

## ⚠️ Важно

- **НЕ УДАЛЯТЬ** старые коллекции до полной верификации
- Проверять каждую миграцию в админке
- Сравнивать количество записей ДО и ПОСЛЕ
- Тестировать API с разными `?locale=`
- Проверять изображения, связи, SEO-поля

---

## 📦 Структура новых коллекций

Все новые коллекции будут:
- Использовать `localized: true` для переводимых полей
- Хранить переводы в `{collection}_locales` таблице
- Поддерживать 3 языка: `ru` (default), `uk`, `en`
- Иметь общие поля (изображения, даты, связи) в основной таблице
