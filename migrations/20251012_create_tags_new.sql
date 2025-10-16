-- Миграция: Создание коллекции tags-new с нативной локализацией Payload
-- Дата: 2025-10-12
-- Описание: Новая таблица для тестирования нативной i18n системы Payload

-- Основная таблица tags_new
CREATE TABLE IF NOT EXISTS navi.tags_new (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    slug VARCHAR(255),
    summary TEXT,
    content JSONB,
    description_for_a_i TEXT,
    image_id INTEGER REFERENCES navi.media(id) ON DELETE SET NULL,
    social_images_thumbnail_id INTEGER REFERENCES navi.media(id) ON DELETE SET NULL,
    social_images_image16x9_id INTEGER REFERENCES navi.media(id) ON DELETE SET NULL,
    social_images_image5x4_id INTEGER REFERENCES navi.media(id) ON DELETE SET NULL,
    seo_title VARCHAR(255),
    seo_description TEXT,
    seo_og_image_id INTEGER REFERENCES navi.media(id) ON DELETE SET NULL,
    seo_focus_keyphrase VARCHAR(255),
    seo_no_index BOOLEAN DEFAULT FALSE,
    seo_no_follow BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW(),
    _status VARCHAR(50) DEFAULT 'draft'
);

-- Таблица локализаций
CREATE TABLE IF NOT EXISTS navi.tags_new_locales (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    slug VARCHAR(255),
    summary TEXT,
    content JSONB,
    description_for_a_i TEXT,
    seo_title VARCHAR(255),
    seo_meta_description TEXT,
    seo_focus_keyphrase VARCHAR(255),
    _locale VARCHAR(10) NOT NULL,
    _parent_id INTEGER NOT NULL REFERENCES navi.tags_new(id) ON DELETE CASCADE
);

-- Таблица связей с постами
CREATE TABLE IF NOT EXISTS navi.tags_new_rels (
    id SERIAL PRIMARY KEY,
    "order" INTEGER,
    parent_id INTEGER NOT NULL REFERENCES navi.tags_new(id) ON DELETE CASCADE,
    path VARCHAR(255) NOT NULL,
    posts_id INTEGER REFERENCES navi.posts(id) ON DELETE CASCADE,
    faqs_id INTEGER REFERENCES navi.faqs(id) ON DELETE CASCADE
);

-- Таблица версий
CREATE TABLE IF NOT EXISTS navi.tags_new_v (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER REFERENCES navi.tags_new(id) ON DELETE SET NULL,
    version_name VARCHAR(255),
    version_slug VARCHAR(255),
    version_summary TEXT,
    version_content JSONB,
    version_description_for_ai TEXT,
    version_seo_title VARCHAR(255),
    version_seo_description TEXT,
    version_focus_keyphrase VARCHAR(255),
    version_no_index BOOLEAN,
    version_no_follow BOOLEAN,
    version_image INTEGER,
    version_seo_image INTEGER,
    version_updated_at TIMESTAMP(3) WITH TIME ZONE,
    version_created_at TIMESTAMP(3) WITH TIME ZONE,
    version__status VARCHAR(50),
    created_at TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW(),
    latest BOOLEAN DEFAULT FALSE,
    autosave BOOLEAN DEFAULT FALSE
);

-- Таблица версий локализаций
CREATE TABLE IF NOT EXISTS navi.tags_new_v_locales (
    id SERIAL PRIMARY KEY,
    version_name VARCHAR(255),
    version_slug VARCHAR(255),
    version_summary TEXT,
    version_content JSONB,
    version_description_for_ai TEXT,
    version_seo_title VARCHAR(255),
    version_seo_description TEXT,
    version_focus_keyphrase VARCHAR(255),
    _locale VARCHAR(10) NOT NULL,
    _parent_id INTEGER NOT NULL REFERENCES navi.tags_new_v(id) ON DELETE CASCADE
);

-- Таблица связей версий
CREATE TABLE IF NOT EXISTS navi.tags_new_v_rels (
    id SERIAL PRIMARY KEY,
    "order" INTEGER,
    parent_id INTEGER NOT NULL REFERENCES navi.tags_new_v(id) ON DELETE CASCADE,
    path VARCHAR(255) NOT NULL,
    posts_id INTEGER REFERENCES navi.posts(id) ON DELETE CASCADE,
    faqs_id INTEGER REFERENCES navi.faqs(id) ON DELETE CASCADE
);

-- socialImages теперь встроены в основную таблицу как колонки
-- Эти таблицы больше не нужны

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS tags_new_slug_idx ON navi.tags_new(slug);
CREATE INDEX IF NOT EXISTS tags_new_status_idx ON navi.tags_new(_status);
CREATE INDEX IF NOT EXISTS tags_new_created_at_idx ON navi.tags_new(created_at DESC);
CREATE INDEX IF NOT EXISTS tags_new_locales_locale_idx ON navi.tags_new_locales(_locale);
CREATE INDEX IF NOT EXISTS tags_new_locales_parent_idx ON navi.tags_new_locales(_parent_id);
CREATE INDEX IF NOT EXISTS tags_new_rels_parent_idx ON navi.tags_new_rels(parent_id);
CREATE INDEX IF NOT EXISTS tags_new_rels_posts_idx ON navi.tags_new_rels(posts_id);
CREATE INDEX IF NOT EXISTS tags_new_rels_faqs_idx ON navi.tags_new_rels(faqs_id);

-- Комментарии
COMMENT ON TABLE navi.tags_new IS 'Tags collection with native Payload i18n (new localization system)';
COMMENT ON TABLE navi.tags_new_locales IS 'Localized fields for tags_new (ru, uk, en)';
COMMENT ON TABLE navi.tags_new_rels IS 'Relationships between tags_new and posts/faqs';
