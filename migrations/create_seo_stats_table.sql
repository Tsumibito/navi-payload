-- Migration: Create seo-stats collection table
-- Created: 2025-10-14
-- Purpose: Separate storage for SEO statistics without modifying main entities

CREATE TABLE IF NOT EXISTS navi."seo-stats" (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(255) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  focus_keyphrase TEXT NOT NULL,
  stats JSONB NOT NULL,
  calculated_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS "seo-stats_entity_type_idx" ON navi."seo-stats" (entity_type);
CREATE INDEX IF NOT EXISTS "seo-stats_entity_id_idx" ON navi."seo-stats" (entity_id);
CREATE INDEX IF NOT EXISTS "seo-stats_entity_composite_idx" ON navi."seo-stats" (entity_type, entity_id);
