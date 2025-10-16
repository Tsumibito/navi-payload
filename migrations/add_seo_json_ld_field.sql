-- Migration: Add seo_json_ld field to all tables with SEO fields
-- Created: 2025-10-14
-- Purpose: Add JSON-LD structured data field to SEO schema

-- Main collections
ALTER TABLE navi.posts ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi.tags ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi.team ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi.certificates ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi.trainings ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi.faqs ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;

-- Translations tables
ALTER TABLE navi.posts_translations ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi.tags_translations ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi.team_translations ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi.certificates_translations ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi.faqs_translations ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;

-- New locales tables (if exist)
ALTER TABLE navi.posts_new_locales ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi.tags_new_locales ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi.team_new_locales ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi.certificates_new_locales ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;

-- Version tables (for drafts)
ALTER TABLE navi._posts_v_version_translations ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;
ALTER TABLE navi._tags_v_version_translations ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;

-- Legacy tables (if needed)
ALTER TABLE navi.tags_new ADD COLUMN IF NOT EXISTS seo_json_ld TEXT;

COMMIT;
