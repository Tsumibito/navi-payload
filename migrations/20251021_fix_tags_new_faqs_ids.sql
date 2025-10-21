-- Миграция: приведение таблиц FAQ для tags-new к строковым идентификаторам
-- Дата: 2025-10-21
-- Описание: Payload ожидает строковые ID для элементов массивов. Преобразуем id и внешние ключи в VARCHAR.

-- Основные FAQ (основная таблица)
ALTER TABLE navi.tags_new_faqs_locales
  DROP CONSTRAINT IF EXISTS tags_new_faqs_locales__parent_id_fkey;

ALTER TABLE navi.tags_new_faqs_v_locales
  DROP CONSTRAINT IF EXISTS tags_new_faqs_v_locales__parent_id_fkey;

ALTER TABLE navi.tags_new_faqs
  DROP CONSTRAINT IF EXISTS tags_new_faqs_pkey;

ALTER TABLE navi.tags_new_faqs
  ALTER COLUMN id TYPE VARCHAR USING id::text,
  ALTER COLUMN id DROP DEFAULT,
  ALTER COLUMN id SET NOT NULL;

DROP SEQUENCE IF EXISTS navi.tags_new_faqs_id_seq;

ALTER TABLE navi.tags_new_faqs
  ADD CONSTRAINT tags_new_faqs_pkey PRIMARY KEY (id);

-- Локализованные FAQ
ALTER TABLE navi.tags_new_faqs_locales
  ALTER COLUMN _parent_id TYPE VARCHAR USING _parent_id::text,
  ALTER COLUMN _parent_id SET NOT NULL;

ALTER TABLE navi.tags_new_faqs_locales
  ADD CONSTRAINT tags_new_faqs_locales_parent_id_fkey
  FOREIGN KEY (_parent_id) REFERENCES navi.tags_new_faqs(id) ON DELETE CASCADE;

-- Версии FAQ
ALTER TABLE navi.tags_new_faqs_v
  DROP CONSTRAINT IF EXISTS tags_new_faqs_v_pkey;

ALTER TABLE navi.tags_new_faqs_v
  ALTER COLUMN id TYPE VARCHAR USING id::text,
  ALTER COLUMN id DROP DEFAULT,
  ALTER COLUMN id SET NOT NULL;

DROP SEQUENCE IF EXISTS navi.tags_new_faqs_v_id_seq;

ALTER TABLE navi.tags_new_faqs_v
  ADD CONSTRAINT tags_new_faqs_v_pkey PRIMARY KEY (id);

ALTER TABLE navi.tags_new_faqs_v_locales
  ALTER COLUMN _parent_id TYPE VARCHAR USING _parent_id::text,
  ALTER COLUMN _parent_id SET NOT NULL;

ALTER TABLE navi.tags_new_faqs_v_locales
  ADD CONSTRAINT tags_new_faqs_v_locales_parent_id_fkey
  FOREIGN KEY (_parent_id) REFERENCES navi.tags_new_faqs_v(id) ON DELETE CASCADE;
