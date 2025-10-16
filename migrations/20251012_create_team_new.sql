-- Миграция: Создание коллекции team-new с нативной локализацией Payload
-- Дата: 2025-10-12
-- Описание: Team members с нативной i18n и встроенными FAQs

-- Основная таблица team_new
-- ВАЖНО: локализованные поля (name, position, bio, bio_summary, seo.title и т.д.) 
-- НЕ должны быть в основной таблице - только в _locales!
CREATE TABLE IF NOT EXISTS navi.team_new (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(255) UNIQUE NOT NULL,
    photo_id INTEGER REFERENCES navi.media(id) ON DELETE SET NULL,
    "order" INTEGER DEFAULT 0,
    seo_og_image_id INTEGER REFERENCES navi.media(id) ON DELETE SET NULL,
    seo_no_index BOOLEAN DEFAULT FALSE,
    seo_no_follow BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW(),
    _status VARCHAR(50) DEFAULT 'draft'
);

-- Таблица локализаций
-- ЗДЕСЬ локализованные поля: name, position, bio, bio_summary, seo.title и т.д.
CREATE TABLE IF NOT EXISTS navi.team_new_locales (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    position VARCHAR(255),
    bio_summary JSONB,
    bio JSONB,
    seo_title VARCHAR(255),
    seo_meta_description TEXT,
    seo_focus_keyphrase VARCHAR(255),
    seo_link_keywords TEXT,
    _locale VARCHAR(10) NOT NULL,
    _parent_id INTEGER NOT NULL REFERENCES navi.team_new(id) ON DELETE CASCADE
);

-- Таблица social links
CREATE TABLE IF NOT EXISTS navi.team_new_links (
    _order INTEGER NOT NULL,
    _parent_id INTEGER NOT NULL REFERENCES navi.team_new(id) ON DELETE CASCADE,
    id VARCHAR PRIMARY KEY,
    service VARCHAR(50),
    url TEXT
);

-- Таблица FAQs (основная, не локализуется сама структура)
CREATE TABLE IF NOT EXISTS navi.team_new_faqs (
    _order INTEGER NOT NULL,
    _parent_id INTEGER NOT NULL REFERENCES navi.team_new(id) ON DELETE CASCADE,
    id VARCHAR PRIMARY KEY,
    question TEXT,
    answer JSONB
);

-- Таблица локализаций FAQs
CREATE TABLE IF NOT EXISTS navi.team_new_faqs_locales (
    id SERIAL PRIMARY KEY,
    question TEXT,
    answer JSONB,
    _locale VARCHAR(10) NOT NULL,
    _parent_id VARCHAR NOT NULL REFERENCES navi.team_new_faqs(id) ON DELETE CASCADE
);

-- Таблица relationships (posts)
CREATE TABLE IF NOT EXISTS navi.team_new_rels (
    "order" INTEGER NOT NULL,
    parent_id INTEGER NOT NULL REFERENCES navi.team_new(id) ON DELETE CASCADE,
    path VARCHAR NOT NULL,
    posts_new_id INTEGER REFERENCES navi.posts_new(id) ON DELETE CASCADE
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS team_new_status_idx ON navi.team_new(_status);
CREATE INDEX IF NOT EXISTS team_new_order_idx ON navi.team_new("order");
CREATE INDEX IF NOT EXISTS team_new_created_at_idx ON navi.team_new(created_at DESC);
CREATE INDEX IF NOT EXISTS team_new_locales_locale_idx ON navi.team_new_locales(_locale);
CREATE INDEX IF NOT EXISTS team_new_locales_parent_idx ON navi.team_new_locales(_parent_id);
CREATE INDEX IF NOT EXISTS team_new_links_parent_idx ON navi.team_new_links(_parent_id);
CREATE INDEX IF NOT EXISTS team_new_faqs_parent_idx ON navi.team_new_faqs(_parent_id);
CREATE INDEX IF NOT EXISTS team_new_faqs_locales_locale_idx ON navi.team_new_faqs_locales(_locale);
CREATE INDEX IF NOT EXISTS team_new_faqs_locales_parent_idx ON navi.team_new_faqs_locales(_parent_id);
CREATE INDEX IF NOT EXISTS team_new_rels_parent_idx ON navi.team_new_rels(parent_id);
CREATE INDEX IF NOT EXISTS team_new_rels_posts_new_idx ON navi.team_new_rels(posts_new_id);

-- Добавляем team_new_id в payload_locked_documents_rels если еще не добавлено
ALTER TABLE payload_locked_documents_rels 
ADD COLUMN IF NOT EXISTS team_new_id INTEGER REFERENCES navi.team_new(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_team_new_idx 
ON payload_locked_documents_rels(team_new_id);

-- Комментарии
COMMENT ON TABLE navi.team_new IS 'Team members with native Payload i18n';
COMMENT ON TABLE navi.team_new_locales IS 'Localized fields for team_new (ru, uk, en)';
COMMENT ON TABLE navi.team_new_faqs IS 'FAQs embedded in team member pages';
COMMENT ON TABLE navi.team_new_faqs_locales IS 'Localized FAQs (question/answer)';
