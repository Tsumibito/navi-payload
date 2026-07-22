import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "navi"."posts_new"
      ADD COLUMN IF NOT EXISTS "localization_workflow_current_stage" varchar;

    ALTER TABLE "navi"."posts_new_locales"
      ADD COLUMN IF NOT EXISTS "social_images_thumbnail_id" integer,
      ADD COLUMN IF NOT EXISTS "social_images_image16x9_id" integer,
      ADD COLUMN IF NOT EXISTS "social_images_image5x4_id" integer,
      ADD COLUMN IF NOT EXISTS "seo_og_image_id" integer;

    UPDATE "navi"."posts_new_locales" AS localized
    SET
      "social_images_thumbnail_id" = source."social_images_thumbnail_id",
      "social_images_image16x9_id" = source."social_images_image16x9_id",
      "social_images_image5x4_id" = source."social_images_image5x4_id",
      "seo_og_image_id" = COALESCE(source."seo_og_image_id", source."social_images_image16x9_id")
    FROM "navi"."posts_new" AS source
    WHERE localized."_parent_id" = source."id"
      AND localized."_locale"::text = source."localization_workflow_source_locale"::text;

    CREATE INDEX IF NOT EXISTS "posts_new_locales_social_thumbnail_idx" ON "navi"."posts_new_locales" ("social_images_thumbnail_id");
    CREATE INDEX IF NOT EXISTS "posts_new_locales_social_image16x9_idx" ON "navi"."posts_new_locales" ("social_images_image16x9_id");
    CREATE INDEX IF NOT EXISTS "posts_new_locales_social_image5x4_idx" ON "navi"."posts_new_locales" ("social_images_image5x4_id");
    CREATE INDEX IF NOT EXISTS "posts_new_locales_seo_og_image_idx" ON "navi"."posts_new_locales" ("seo_og_image_id");

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_new_locales_social_thumbnail_media_fk') THEN
        ALTER TABLE "navi"."posts_new_locales" ADD CONSTRAINT "posts_new_locales_social_thumbnail_media_fk" FOREIGN KEY ("social_images_thumbnail_id") REFERENCES "navi"."media"("id") ON DELETE set null;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_new_locales_social_image16x9_media_fk') THEN
        ALTER TABLE "navi"."posts_new_locales" ADD CONSTRAINT "posts_new_locales_social_image16x9_media_fk" FOREIGN KEY ("social_images_image16x9_id") REFERENCES "navi"."media"("id") ON DELETE set null;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_new_locales_social_image5x4_media_fk') THEN
        ALTER TABLE "navi"."posts_new_locales" ADD CONSTRAINT "posts_new_locales_social_image5x4_media_fk" FOREIGN KEY ("social_images_image5x4_id") REFERENCES "navi"."media"("id") ON DELETE set null;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_new_locales_seo_og_image_media_fk') THEN
        ALTER TABLE "navi"."posts_new_locales" ADD CONSTRAINT "posts_new_locales_seo_og_image_media_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "navi"."media"("id") ON DELETE set null;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "navi"."posts_new_locales" DROP CONSTRAINT IF EXISTS "posts_new_locales_social_thumbnail_media_fk";
    ALTER TABLE "navi"."posts_new_locales" DROP CONSTRAINT IF EXISTS "posts_new_locales_social_image16x9_media_fk";
    ALTER TABLE "navi"."posts_new_locales" DROP CONSTRAINT IF EXISTS "posts_new_locales_social_image5x4_media_fk";
    ALTER TABLE "navi"."posts_new_locales" DROP CONSTRAINT IF EXISTS "posts_new_locales_seo_og_image_media_fk";
    DROP INDEX IF EXISTS "navi"."posts_new_locales_social_thumbnail_idx";
    DROP INDEX IF EXISTS "navi"."posts_new_locales_social_image16x9_idx";
    DROP INDEX IF EXISTS "navi"."posts_new_locales_social_image5x4_idx";
    DROP INDEX IF EXISTS "navi"."posts_new_locales_seo_og_image_idx";
    ALTER TABLE "navi"."posts_new_locales"
      DROP COLUMN IF EXISTS "social_images_thumbnail_id",
      DROP COLUMN IF EXISTS "social_images_image16x9_id",
      DROP COLUMN IF EXISTS "social_images_image5x4_id",
      DROP COLUMN IF EXISTS "seo_og_image_id";
    ALTER TABLE "navi"."posts_new" DROP COLUMN IF EXISTS "localization_workflow_current_stage";
  `)
}
