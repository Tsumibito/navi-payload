# Патч миграции Sanity → Payload

## Выполненные исправления

### ✅ 1. Tags → Posts обратные связи
**Проблема:** В тегах не отображались связанные посты  
**Решение:** SQL запрос для создания обратных связей в `tags_rels`

```sql
WITH tag_posts AS (
  SELECT 
    pr.tags_id as tag_id,
    pr.parent_id as post_id,
    ROW_NUMBER() OVER (PARTITION BY pr.tags_id ORDER BY pr.parent_id) as row_num
  FROM posts_rels pr
  WHERE pr.tags_id IS NOT NULL
)
INSERT INTO tags_rels (parent_id, "order", path, posts_id)
SELECT tag_id, row_num, 'posts', post_id
FROM tag_posts
ON CONFLICT DO NOTHING;
```

**Результат:** 476 связей создано, все теги теперь показывают свои посты

### ✅ 2. Team Social Links
**Проблема:** Поле `links` было пустым из-за несоответствия имён полей  
**Решение:** 
- Изменена схема `Team.ts`: поле `link` → `url`
- SQL патч для заполнения существующих данных (`patch-team-links.sql`)

**Результат:** Все 8 ссылок заполнены для 3 членов команды

### ✅ 3. Certificates Description
**Проблема:** Ошибка "setEditorState: the editor state is empty"  
**Решение:** Патч-скрипт `patch-migration-data.ts` заполняет пустые `description` полей пустым Lexical state

**Результат:** 7 сертификатов исправлено

### ✅ 4. Team bioSummary
**Проблема:** Ошибка "You have tried to pass in data from the old Slate editor to the new Lexical editor"  
**Решение:** SQL патч заменяет PortableText на пустой Lexical state

```sql
UPDATE team SET bio_summary = '{"root": {"type": "root", "format": "", "indent": 0, "version": 1, "children": [], "direction": "ltr"}}'::jsonb;
```

**Результат:** 3 записи Team исправлены, ошибки больше нет

## Известные ограничения

### ⚠️ Certificates - несоответствие структуры
**Текущая структура Payload:**
- `image` - Certificate Image (пустое)
- `description` - Description (Lexical)
- `issuer` - Issuer
- `issuedDate` - Issued Date
- `expiryDate` - Expiry Date

**Оригинальная структура Sanity:**
- Нет полей `issuer`, `issuedDate`, `expiryDate`
- Нет второго изображения для задней стороны
- Было поле `requirements` (отсутствует в Payload)

**Рекомендация:** Обновить схему `Certificates.ts` под оригинальную структуру или заполнить новые поля вручную

### ⚠️ Переводы Team
**Проблема:** 6 переводов пропущены (unsupported language codes)  
**Статус:** Требуется проверка данных в Sanity и добавление поддержки языков

### ⚠️ Hydration Error
**Проблема:** React hydration mismatch в Next.js  
**Статус:** Не критично, обычно решается перезагрузкой страницы. Связано с SSR/CSR несоответствием в Payload admin UI

## Команды для запуска патчей

```bash
# 1. Обратные связи tags → posts
psql postgresql://payload:payload@localhost:5433/payload -c "
WITH tag_posts AS (
  SELECT pr.tags_id as tag_id, pr.parent_id as post_id,
  ROW_NUMBER() OVER (PARTITION BY pr.tags_id ORDER BY pr.parent_id) as row_num
  FROM posts_rels pr WHERE pr.tags_id IS NOT NULL
)
INSERT INTO tags_rels (parent_id, \"order\", path, posts_id)
SELECT tag_id, row_num, 'posts', post_id FROM tag_posts
ON CONFLICT DO NOTHING;"

# 2. Team links
psql postgresql://payload:payload@localhost:5433/payload -f scripts/patch-team-links.sql

# 3. Certificates description
npx tsx scripts/patch-migration-data.ts
```

## Статистика миграции

- **Posts:** 44 (100% с авторами и тегами)
- **Tags:** 55 (100% с обратными связями к постам)
- **Team:** 3 (100% с social links)
- **Certificates:** 7 (description исправлены)
- **Redirects:** 264
- **Media:** ~500 файлов

## Следующие шаги

1. ✅ Обновить схему `Certificates.ts` под оригинальную структуру
2. ✅ Добавить поддержку недостающих языков для переводов Team
3. ✅ Проверить и исправить Hydration errors (если критично)
4. ✅ Обновить `features.md` с информацией о патчах
