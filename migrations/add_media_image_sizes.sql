-- Добавление полей для imageSizes в таблицу media
-- Выполнить: psql -d <database> -c "SET search_path TO navi; \i migrations/add_media_image_sizes.sql"

-- Добавляем колонки для thumbnail (150x150, cover)
ALTER TABLE media 
ADD COLUMN IF NOT EXISTS sizes_thumbnail_url varchar,
ADD COLUMN IF NOT EXISTS sizes_thumbnail_width integer,
ADD COLUMN IF NOT EXISTS sizes_thumbnail_height integer,
ADD COLUMN IF NOT EXISTS sizes_thumbnail_mime_type varchar,
ADD COLUMN IF NOT EXISTS sizes_thumbnail_filesize integer,
ADD COLUMN IF NOT EXISTS sizes_thumbnail_filename varchar;

-- Добавляем колонки для post (800px width, inside)
ALTER TABLE media 
ADD COLUMN IF NOT EXISTS sizes_post_url varchar,
ADD COLUMN IF NOT EXISTS sizes_post_width integer,
ADD COLUMN IF NOT EXISTS sizes_post_height integer,
ADD COLUMN IF NOT EXISTS sizes_post_mime_type varchar,
ADD COLUMN IF NOT EXISTS sizes_post_filesize integer,
ADD COLUMN IF NOT EXISTS sizes_post_filename varchar;

-- Добавляем колонки для card (640px width, inside)
ALTER TABLE media 
ADD COLUMN IF NOT EXISTS sizes_card_url varchar,
ADD COLUMN IF NOT EXISTS sizes_card_width integer,
ADD COLUMN IF NOT EXISTS sizes_card_height integer,
ADD COLUMN IF NOT EXISTS sizes_card_mime_type varchar,
ADD COLUMN IF NOT EXISTS sizes_card_filesize integer,
ADD COLUMN IF NOT EXISTS sizes_card_filename varchar;

-- Добавляем колонки для og (1200x630, cover)
ALTER TABLE media 
ADD COLUMN IF NOT EXISTS sizes_og_url varchar,
ADD COLUMN IF NOT EXISTS sizes_og_width integer,
ADD COLUMN IF NOT EXISTS sizes_og_height integer,
ADD COLUMN IF NOT EXISTS sizes_og_mime_type varchar,
ADD COLUMN IF NOT EXISTS sizes_og_filesize integer,
ADD COLUMN IF NOT EXISTS sizes_og_filename varchar;

-- Добавляем колонки для featured (1920px width, inside)
ALTER TABLE media 
ADD COLUMN IF NOT EXISTS sizes_featured_url varchar,
ADD COLUMN IF NOT EXISTS sizes_featured_width integer,
ADD COLUMN IF NOT EXISTS sizes_featured_height integer,
ADD COLUMN IF NOT EXISTS sizes_featured_mime_type varchar,
ADD COLUMN IF NOT EXISTS sizes_featured_filesize integer,
ADD COLUMN IF NOT EXISTS sizes_featured_filename varchar;

-- Индексы для оптимизации запросов по размерам
CREATE INDEX IF NOT EXISTS media_sizes_thumbnail_url_idx ON media(sizes_thumbnail_url);
CREATE INDEX IF NOT EXISTS media_sizes_post_url_idx ON media(sizes_post_url);
CREATE INDEX IF NOT EXISTS media_sizes_card_url_idx ON media(sizes_card_url);
CREATE INDEX IF NOT EXISTS media_sizes_og_url_idx ON media(sizes_og_url);
CREATE INDEX IF NOT EXISTS media_sizes_featured_url_idx ON media(sizes_featured_url);
