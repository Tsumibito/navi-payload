-- Миграция: Создание коллекции certificates-new с нативной локализацией Payload
-- Дата: 2025-10-12
-- Описание: Certificates с нативной i18n

-- Основная таблица certificates_new
-- Локализованные поля (title, slug, description, requirements, program) НЕ должны быть здесь - только в _locales!
CREATE TABLE IF NOT EXISTS navi.certificates_new (
    id SERIAL PRIMARY KEY,
    front_image_id INTEGER REFERENCES navi.media(id) ON DELETE SET NULL,
    back_image_id INTEGER REFERENCES navi.media(id) ON DELETE SET NULL,
    seo_og_image_id INTEGER REFERENCES navi.media(id) ON DELETE SET NULL,
    seo_no_index BOOLEAN DEFAULT FALSE,
    seo_no_follow BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW(),
    _status VARCHAR(50) DEFAULT 'draft'
);

-- Таблица локализаций
-- ЗДЕСЬ локализованные поля: name, slug, description, requirements, program, seo полей
CREATE TABLE IF NOT EXISTS navi.certificates_new_locales (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    slug VARCHAR(255),
    description JSONB,
    requirements JSONB,
    program JSONB,
    seo_title VARCHAR(255),
    seo_meta_description TEXT,
    seo_focus_keyphrase VARCHAR(255),
    seo_link_keywords TEXT,
    _locale VARCHAR(10) NOT NULL,
    _parent_id INTEGER NOT NULL REFERENCES navi.certificates_new(id) ON DELETE CASCADE,
    UNIQUE(_parent_id, _locale, slug)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS certificates_new_front_image_idx ON navi.certificates_new(front_image_id);
CREATE INDEX IF NOT EXISTS certificates_new_back_image_idx ON navi.certificates_new(back_image_id);
CREATE INDEX IF NOT EXISTS certificates_new_seo_og_image_idx ON navi.certificates_new(seo_og_image_id);
CREATE INDEX IF NOT EXISTS certificates_new_status_idx ON navi.certificates_new(_status);
CREATE INDEX IF NOT EXISTS certificates_new_created_at_idx ON navi.certificates_new(created_at);
CREATE INDEX IF NOT EXISTS certificates_new_updated_at_idx ON navi.certificates_new(updated_at);
CREATE INDEX IF NOT EXISTS certificates_new_locales_parent_idx ON navi.certificates_new_locales(_parent_id);
CREATE INDEX IF NOT EXISTS certificates_new_locales_locale_idx ON navi.certificates_new_locales(_locale);
CREATE INDEX IF NOT EXISTS certificates_new_locales_slug_idx ON navi.certificates_new_locales(slug);

-- Payload locked documents support
ALTER TABLE navi.payload_locked_documents_rels 
ADD COLUMN IF NOT EXISTS certificates_new_id INTEGER REFERENCES navi.certificates_new(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_certificates_new_idx 
ON navi.payload_locked_documents_rels(certificates_new_id);

-- Комментарии для документации
COMMENT ON TABLE navi.certificates_new IS 'Certificates с нативной Payload локализацией';
COMMENT ON TABLE navi.certificates_new_locales IS 'Локализованный контент для certificates_new (name, slug, description, requirements, program, SEO)';
COMMENT ON COLUMN navi.certificates_new_locales._locale IS 'Код локали: ru, uk, en';
COMMENT ON COLUMN navi.certificates_new_locales._parent_id IS 'Ссылка на запись в certificates_new';
