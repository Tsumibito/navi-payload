-- Миграция: Создание коллекции posts-new с нативной локализацией Payload
-- Дата: 2025-10-12
-- Описание: Blog posts с нативной i18n и встроенными FAQs

-- Основная таблица posts_new
-- Локализованные поля (name, slug, summary, content) НЕ должны быть здесь - только в _locales!
CREATE TABLE IF NOT EXISTS navi.posts_new (
    id SERIAL PRIMARY KEY,
    image_id INTEGER REFERENCES navi.media(id) ON DELETE SET NULL,
    featured BOOLEAN DEFAULT FALSE,
    author_id INTEGER REFERENCES navi.team_new(id) ON DELETE SET NULL,
    social_images_thumbnail_id INTEGER REFERENCES navi.media(id) ON DELETE SET NULL,
    social_images_image16x9_id INTEGER REFERENCES navi.media(id) ON DELETE SET NULL,
    social_images_image5x4_id INTEGER REFERENCES navi.media(id) ON DELETE SET NULL,
    seo_og_image_id INTEGER REFERENCES navi.media(id) ON DELETE SET NULL,
    seo_no_index BOOLEAN DEFAULT FALSE,
    seo_no_follow BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW(),
    _status VARCHAR(50) DEFAULT 'draft'
);

-- Таблица локализаций
-- ЗДЕСЬ локализованные поля: name, slug, summary, content, seo.title и т.д.
CREATE TABLE IF NOT EXISTS navi.posts_new_locales (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    slug VARCHAR(255),
    summary TEXT,
    content JSONB,
    seo_title VARCHAR(255),
    seo_meta_description TEXT,
    seo_focus_keyphrase VARCHAR(255),
    seo_link_keywords TEXT,
    _locale VARCHAR(10) NOT NULL,
    _parent_id INTEGER NOT NULL REFERENCES navi.posts_new(id) ON DELETE CASCADE,
    UNIQUE(_parent_id, _locale, slug)
);

-- Таблица FAQs (основная)
CREATE TABLE IF NOT EXISTS navi.posts_new_faqs (
    _order INTEGER NOT NULL,
    _parent_id INTEGER NOT NULL REFERENCES navi.posts_new(id) ON DELETE CASCADE,
    id VARCHAR PRIMARY KEY,
    question TEXT,
    answer JSONB
);

-- Таблица локализаций FAQs
CREATE TABLE IF NOT EXISTS navi.posts_new_faqs_locales (
    id SERIAL PRIMARY KEY,
    question TEXT,
    answer JSONB,
    _locale VARCHAR(10) NOT NULL,
    _parent_id VARCHAR NOT NULL REFERENCES navi.posts_new_faqs(id) ON DELETE CASCADE
);

-- Таблица relationships (author, tags)
CREATE TABLE IF NOT EXISTS navi.posts_new_rels (
    id SERIAL PRIMARY KEY,
    "order" INTEGER NOT NULL,
    parent_id INTEGER NOT NULL REFERENCES navi.posts_new(id) ON DELETE CASCADE,
    path VARCHAR NOT NULL,
    team_new_id INTEGER REFERENCES navi.team_new(id) ON DELETE CASCADE,
    tags_new_id INTEGER REFERENCES navi.tags_new(id) ON DELETE CASCADE
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS posts_new_slug_idx ON navi.posts_new(slug);
CREATE INDEX IF NOT EXISTS posts_new_status_idx ON navi.posts_new(_status);
CREATE INDEX IF NOT EXISTS posts_new_published_at_idx ON navi.posts_new(published_at DESC);
CREATE INDEX IF NOT EXISTS posts_new_featured_idx ON navi.posts_new(featured);
CREATE INDEX IF NOT EXISTS posts_new_created_at_idx ON navi.posts_new(created_at DESC);
CREATE INDEX IF NOT EXISTS posts_new_locales_locale_idx ON navi.posts_new_locales(_locale);
CREATE INDEX IF NOT EXISTS posts_new_locales_parent_idx ON navi.posts_new_locales(_parent_id);
CREATE INDEX IF NOT EXISTS posts_new_faqs_parent_idx ON navi.posts_new_faqs(_parent_id);
CREATE INDEX IF NOT EXISTS posts_new_faqs_locales_locale_idx ON navi.posts_new_faqs_locales(_locale);
CREATE INDEX IF NOT EXISTS posts_new_faqs_locales_parent_idx ON navi.posts_new_faqs_locales(_parent_id);
CREATE INDEX IF NOT EXISTS posts_new_rels_parent_idx ON navi.posts_new_rels(parent_id);
CREATE INDEX IF NOT EXISTS posts_new_rels_team_new_idx ON navi.posts_new_rels(team_new_id);
CREATE INDEX IF NOT EXISTS posts_new_rels_tags_new_idx ON navi.posts_new_rels(tags_new_id);

-- Добавляем posts_new_id в payload_locked_documents_rels
ALTER TABLE payload_locked_documents_rels 
ADD COLUMN IF NOT EXISTS posts_new_id INTEGER REFERENCES navi.posts_new(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_posts_new_idx 
ON payload_locked_documents_rels(posts_new_id);

-- Комментарии
COMMENT ON TABLE navi.posts_new IS 'Blog posts with native Payload i18n';
COMMENT ON TABLE navi.posts_new_locales IS 'Localized fields for posts_new (ru, uk, en)';
COMMENT ON TABLE navi.posts_new_faqs IS 'FAQs embedded in post pages';
COMMENT ON TABLE navi.posts_new_faqs_locales IS 'Localized FAQs (question/answer)';
