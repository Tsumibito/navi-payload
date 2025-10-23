-- Migration: Create site_globals_available_languages table
-- Created: 2025-10-23
-- Purpose: Support array field availableLanguages in Site Globals

BEGIN;

CREATE TABLE IF NOT EXISTS site_globals_available_languages (
  _order INTEGER NOT NULL,
  _parent_id INTEGER NOT NULL,
  id VARCHAR PRIMARY KEY,
  code VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  flag VARCHAR,
  enabled BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS site_globals_available_languages_order_idx
  ON site_globals_available_languages (_order);

CREATE INDEX IF NOT EXISTS site_globals_available_languages_parent_id_idx
  ON site_globals_available_languages (_parent_id);

ALTER TABLE site_globals_available_languages
  ADD CONSTRAINT site_globals_available_languages_parent_id_fk
  FOREIGN KEY (_parent_id)
  REFERENCES site_globals (id)
  ON DELETE CASCADE;

-- Prefill default languages if none exist for current globals
WITH existing AS (
  SELECT DISTINCT _parent_id FROM site_globals_available_languages
), target_globals AS (
  SELECT id FROM site_globals sg
  WHERE NOT EXISTS (
    SELECT 1 FROM existing e WHERE e._parent_id = sg.id
  )
), default_languages AS (
  SELECT * FROM (VALUES
    (0, 'ru', 'Русский', '🇷🇺', TRUE, TRUE),
    (1, 'uk', 'Українська', '🇺🇦', TRUE, FALSE),
    (2, 'en', 'English', '🇬🇧', TRUE, FALSE)
  ) AS v(_order, code, name, flag, enabled, is_default)
)
INSERT INTO site_globals_available_languages
  (_order, _parent_id, id, code, name, flag, enabled, is_default)
SELECT
  dl._order,
  tg.id,
  CONCAT('lang_', md5(random()::text || clock_timestamp()::text)),
  dl.code,
  dl.name,
  dl.flag,
  dl.enabled,
  dl.is_default
FROM target_globals tg
CROSS JOIN default_languages dl;

COMMIT;
