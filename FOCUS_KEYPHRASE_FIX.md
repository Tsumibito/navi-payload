# ✅ Focus Keyphrase Analysis - Исправление сохранения

## Проблема
После нажатия "Пересчитать" данные Focus Keyphrase не сохранялись. При перезагрузке страницы все данные исчезали.

## Причина
Данные обновлялись только в локальном состоянии формы через `dispatch`, но **не сохранялись в БД**.

## Решение

### 1. Загрузка из БД при монтировании

**До:**
```typescript
// Загружалось только из поля формы (которое пустое после перезагрузки)
useEffect(() => {
  if (statsField && typeof statsField === 'object') {
    setStats({ ...EMPTY_STATS, ...statsField });
  }
}, []);
```

**После:**
```typescript
// Загружается из БД через API /api/seo-stats
useEffect(() => {
  const loadStats = async () => {
    // Сначала пробуем загрузить из поля формы
    if (statsField && typeof statsField === 'object') {
      setStats({ ...EMPTY_STATS, ...statsField });
      console.log('[FocusKeyphraseAnalyzer] Loaded from form field');
      return;
    }

    // Если нет в поле формы, загружаем из БД
    if (docInfo?.id && docInfo?.collectionSlug) {
      const response = await fetch(
        `/api/seo-stats?entity_type=${docInfo.collectionSlug}&entity_id=${docInfo.id}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data && data.stats) {
          setStats({ ...EMPTY_STATS, ...data.stats });
          console.log('[FocusKeyphraseAnalyzer] Loaded from database');
        }
      }
    }
  };

  loadStats();
}, []);
```

### 2. Сохранение в БД после пересчета

**До:**
```typescript
// Только dispatch - данные НЕ сохранялись в БД
if (dispatch) {
  dispatch({ type: 'UPDATE', path, value: updatedStats });
}
```

**После:**
```typescript
// 1. Обновляем локальное состояние и форму
setStats(updatedStats);

if (dispatch) {
  dispatch({ type: 'UPDATE', path, value: updatedStats });
}

// 2. Сохраняем в БД
await fetch('/api/seo-stats', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entity_type: docInfo.collectionSlug,
    entity_id: String(docInfo.id),
    focus_keyphrase: focusKeyphrase,
    stats: updatedStats, // ВАЖНО: правильное имя поля!
    calculated_at: new Date().toISOString(),
  }),
});
```

## Как работает

```
┌─────────────────────────────────────────────────┐
│  1. Пользователь открывает страницу поста      │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  2. useEffect загружает данные из БД            │
│     GET /api/seo-stats?entity_type=posts-new    │
│                        &entity_id=16            │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  3. Данные появляются в компоненте              │
│     ✅ Все метрики на месте!                    │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  4. Пользователь нажимает "Пересчитать"        │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  5. Новые данные рассчитываются и сохраняются  │
│     POST /api/seo-stats                         │
│     { stats: { ... все метрики ... } }          │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  6. Пользователь перезагружает страницу        │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  7. Данные снова загружаются из БД              │
│     ✅ Все на месте!                            │
└─────────────────────────────────────────────────┘
```

## Таблица в БД

Используется таблица `navi."seo-stats"`:

| Поле | Тип | Описание |
|------|-----|----------|
| `entity_type` | string | Коллекция (posts-new, tags-new и т.д.) |
| `entity_id` | string | ID документа |
| `focus_keyphrase` | string | Ключевая фраза |
| `stats` | jsonb | **ВСЕ метрики Focus Keyphrase** |
| `link_keywords` | jsonb | Link Keywords данные |
| `calculated_at` | timestamp | Время расчета |
| `created_at` | timestamp | Время создания записи |
| `updated_at` | timestamp | Время обновления |

## Тестирование

### Тест 1: Сохранение

```bash
# 1. Открыть консоль браузера (F12)

# 2. Открыть пост
http://localhost:3000/admin/collections/posts-new/16?locale=uk

# 3. Заполнить Focus Keyphrase: "види яхтових прав"

# 4. Нажать "Пересчитать"

# 5. Проверить логи в консоли:
[FocusKeyphraseAnalyzer] Updated stats: { inName: true, ... }
[FocusKeyphraseAnalyzer] Saved to database successfully: { entity_type: "posts-new", ... }
```

### Тест 2: Загрузка после перезагрузки

```bash
# 1. После теста 1, перезагрузить страницу (F5)

# 2. Проверить логи:
[FocusKeyphraseAnalyzer] Loaded from database: { inName: true, ... }

# 3. Проверить UI:
✅ В названии: галочка
✅ В SEO Title: галочка/крестик
✅ Внутренние ссылки: число
✅ Потенциальные ссылки: число
✅ Все остальные метрики на месте
```

### Тест 3: Повторный пересчет

```bash
# 1. Изменить Focus Keyphrase на другую

# 2. Нажать "Пересчитать"

# 3. Перезагрузить страницу

# 4. Проверить:
✅ Новые данные загрузились
✅ Старые данные заменились новыми
```

## Логи для отладки

При загрузке:
```
[FocusKeyphraseAnalyzer] Loaded from database: {
  inName: true,
  inSeoTitle: false,
  inMetaDescription: 2,
  inSummary: 1,
  inContent: 8,
  contentPercentage: 1.2,
  inHeadings: 3,
  inFaq: 0,
  internalLinks: 3,
  potentialLinks: 12,
  contentSignature: null,
  updatedAt: "2025-10-15T15:30:00.000Z"
}
```

При сохранении:
```
[FocusKeyphraseAnalyzer] Saved to database successfully: {
  id: 123,
  entity_type: "posts-new",
  entity_id: "16",
  focus_keyphrase: "види яхтових прав",
  stats: { ... },
  calculated_at: "2025-10-15T15:30:00.000Z",
  created_at: "2025-10-15T15:00:00.000Z",
  updated_at: "2025-10-15T15:30:00.000Z"
}
```

## Итого

### ✅ Исправлено:
1. Данные **загружаются из БД** при открытии страницы
2. Данные **сохраняются в БД** после пересчета
3. Данные **НЕ исчезают** после перезагрузки

### 🔍 Как проверить:
1. Нажать "Пересчитать"
2. Перезагрузить страницу (F5)
3. **Все данные на месте!** ✅

**Проблема решена!** 🎉
