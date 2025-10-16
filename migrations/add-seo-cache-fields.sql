-- Добавление полей для кэширования SEO данных
-- Выполнить: psql -d <database_name> -f migrations/add-seo-cache-fields.sql

-- Posts (основная таблица)
ALTER TABLE posts_new 
ADD COLUMN IF NOT EXISTS seo_focus_keyphrase_stats jsonb,
ADD COLUMN IF NOT EXISTS seo_additional_fields jsonb;

-- Posts locales (переводы)
ALTER TABLE posts_new_locales 
ADD COLUMN IF NOT EXISTS seo_focus_keyphrase_stats jsonb,
ADD COLUMN IF NOT EXISTS seo_additional_fields jsonb;

-- Tags (основная таблица)
ALTER TABLE tags_new 
ADD COLUMN IF NOT EXISTS seo_focus_keyphrase_stats jsonb,
ADD COLUMN IF NOT EXISTS seo_additional_fields jsonb;

-- Tags locales (переводы)
ALTER TABLE tags_new_locales 
ADD COLUMN IF NOT EXISTS seo_focus_keyphrase_stats jsonb,
ADD COLUMN IF NOT EXISTS seo_additional_fields jsonb;

-- Team (основная таблица)
ALTER TABLE team_new 
ADD COLUMN IF NOT EXISTS seo_focus_keyphrase_stats jsonb,
ADD COLUMN IF NOT EXISTS seo_additional_fields jsonb;

-- Team locales (переводы)
ALTER TABLE team_new_locales 
ADD COLUMN IF NOT EXISTS seo_focus_keyphrase_stats jsonb,
ADD COLUMN IF NOT EXISTS seo_additional_fields jsonb;

-- Certificates (основная таблица, НЕТ локализации)
ALTER TABLE certificates 
ADD COLUMN IF NOT EXISTS seo_focus_keyphrase_stats jsonb,
ADD COLUMN IF NOT EXISTS seo_additional_fields jsonb;

-- Trainings (основная таблица, НЕТ локализации)
ALTER TABLE trainings 
ADD COLUMN IF NOT EXISTS seo_focus_keyphrase_stats jsonb,
ADD COLUMN IF NOT EXISTS seo_additional_fields jsonb;
