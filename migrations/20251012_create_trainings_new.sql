-- Миграция: Создание коллекции trainings-new с нативной локализацией Payload
-- Дата: 2025-10-12
-- Описание: Trainings с нативной i18n (простая коллекция: name, slug)

-- Основная таблица trainings_new
-- Локализованные поля (name, slug) НЕ должны быть здесь - только в _locales!
CREATE TABLE IF NOT EXISTS navi.trainings_new (
    id SERIAL PRIMARY KEY,
    updated_at TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW(),
    _status VARCHAR(50) DEFAULT 'draft'
);

-- Таблица локализаций
-- ЗДЕСЬ локализованные поля: name, slug
CREATE TABLE IF NOT EXISTS navi.trainings_new_locales (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    slug VARCHAR(255),
    _locale VARCHAR(10) NOT NULL,
    _parent_id INTEGER NOT NULL REFERENCES navi.trainings_new(id) ON DELETE CASCADE,
    UNIQUE(_parent_id, _locale, slug)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS trainings_new_status_idx ON navi.trainings_new(_status);
CREATE INDEX IF NOT EXISTS trainings_new_created_at_idx ON navi.trainings_new(created_at);
CREATE INDEX IF NOT EXISTS trainings_new_updated_at_idx ON navi.trainings_new(updated_at);
CREATE INDEX IF NOT EXISTS trainings_new_locales_parent_idx ON navi.trainings_new_locales(_parent_id);
CREATE INDEX IF NOT EXISTS trainings_new_locales_locale_idx ON navi.trainings_new_locales(_locale);
CREATE INDEX IF NOT EXISTS trainings_new_locales_slug_idx ON navi.trainings_new_locales(slug);

-- Payload locked documents support
ALTER TABLE navi.payload_locked_documents_rels 
ADD COLUMN IF NOT EXISTS trainings_new_id INTEGER REFERENCES navi.trainings_new(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_trainings_new_idx 
ON navi.payload_locked_documents_rels(trainings_new_id);

-- Комментарии для документации
COMMENT ON TABLE navi.trainings_new IS 'Trainings с нативной Payload локализацией';
COMMENT ON TABLE navi.trainings_new_locales IS 'Локализованный контент для trainings_new (name, slug)';
COMMENT ON COLUMN navi.trainings_new_locales._locale IS 'Код локали: ru, uk, en';
COMMENT ON COLUMN navi.trainings_new_locales._parent_id IS 'Ссылка на запись в trainings_new';
