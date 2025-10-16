-- Migration: Add seo_json_ld field to *_new collections
-- Created: 2025-10-14
-- Purpose: Fix missing JSON-LD field in posts-new, team-new, trainings-new collections

-- Main *_new collections
ALTER TABLE navi.posts_new ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi.team_new ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi.trainings_new ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;

-- Locales tables for native i18n
ALTER TABLE navi.posts_new_locales ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi.team_new_locales ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi.trainings_new_locales ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi.tags_new_locales ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;

-- Version tables (if exist)
ALTER TABLE navi.tags_new_v_locales ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi.posts_new_faqs_locales ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi.team_new_faqs_locales ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;

COMMIT;
