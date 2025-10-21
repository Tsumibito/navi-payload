-- Миграция: Добавление таблиц FAQ для коллекции tags-new
-- Дата: 2025-10-21
-- Описание: Создает таблицы tags_new_faqs + локали для поддержки массива FAQ с нативной локализацией

-- Таблица FAQ (массив в Payload с локализацией на уровне элементов)
CREATE TABLE IF NOT EXISTS navi.tags_new_faqs (
    id SERIAL PRIMARY KEY,
    _order INTEGER NOT NULL,
    _parent_id INTEGER NOT NULL REFERENCES navi.tags_new(id) ON DELETE CASCADE,
    created_at TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW()
);

-- Таблица локализованных значений FAQ
CREATE TABLE IF NOT EXISTS navi.tags_new_faqs_locales (
    id SERIAL PRIMARY KEY,
    question TEXT,
    answer JSONB,
    _locale VARCHAR(10) NOT NULL,
    _parent_id INTEGER NOT NULL REFERENCES navi.tags_new_faqs(id) ON DELETE CASCADE
);

-- Таблица версий FAQ
CREATE TABLE IF NOT EXISTS navi.tags_new_faqs_v (
    id SERIAL PRIMARY KEY,
    _order INTEGER,
    _parent_id INTEGER REFERENCES navi.tags_new_v(id) ON DELETE CASCADE,
    created_at TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW()
);

-- Таблица локализованных версий FAQ
CREATE TABLE IF NOT EXISTS navi.tags_new_faqs_v_locales (
    id SERIAL PRIMARY KEY,
    question TEXT,
    answer JSONB,
    _locale VARCHAR(10) NOT NULL,
    _parent_id INTEGER NOT NULL REFERENCES navi.tags_new_faqs_v(id) ON DELETE CASCADE
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS tags_new_faqs_parent_idx ON navi.tags_new_faqs(_parent_id);
CREATE INDEX IF NOT EXISTS tags_new_faqs_locales_parent_idx ON navi.tags_new_faqs_locales(_parent_id);
CREATE INDEX IF NOT EXISTS tags_new_faqs_locales_locale_idx ON navi.tags_new_faqs_locales(_locale);
CREATE INDEX IF NOT EXISTS tags_new_faqs_v_parent_idx ON navi.tags_new_faqs_v(_parent_id);
CREATE INDEX IF NOT EXISTS tags_new_faqs_v_locales_parent_idx ON navi.tags_new_faqs_v_locales(_parent_id);
CREATE INDEX IF NOT EXISTS tags_new_faqs_v_locales_locale_idx ON navi.tags_new_faqs_v_locales(_locale);

-- Комментарии
COMMENT ON TABLE navi.tags_new_faqs IS 'FAQ items for tags-new collection';
COMMENT ON TABLE navi.tags_new_faqs_locales IS 'Localized FAQ entries for tags-new collection';
COMMENT ON TABLE navi.tags_new_faqs_v IS 'Versioned FAQ items for tags-new';
COMMENT ON TABLE navi.tags_new_faqs_v_locales IS 'Localized versioned FAQ entries for tags-new';
