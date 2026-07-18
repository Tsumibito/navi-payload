import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Sprint 3C-0 — curated schema alignment migration.
 *
 * Addresses residual drift from Sprint 3B:
 * - Creates the Payload locale enum (`navi._locales`).
 * - Creates missing version tables for `trainings_new` (`_trainings_new_v`, `_trainings_new_v_locales`).
 * - Converts all `_locale` columns from `varchar` to `navi._locales`.
 *
 * The drift was originally detected by `payload migrate:create` but the generated
 * migration omitted `CREATE TYPE` and the missing `CREATE TABLE` statements.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Locale enum required by Payload for all localized columns.
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'navi' AND t.typname = '_locales'
      ) THEN
        CREATE TYPE "navi"."_locales" AS ENUM('ru', 'uk', 'en');
      END IF;
    END $$;

    -- Version enums for trainings_new (versions: { drafts: ... }).
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'navi' AND t.typname = 'enum__trainings_new_v_version_status'
      ) THEN
        CREATE TYPE "navi"."enum__trainings_new_v_version_status" AS ENUM('draft', 'published');
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'navi' AND t.typname = 'enum__trainings_new_v_published_locale'
      ) THEN
        CREATE TYPE "navi"."enum__trainings_new_v_published_locale" AS ENUM('ru', 'uk', 'en');
      END IF;
    END $$;

    -- Missing version tables for trainings_new.
    CREATE TABLE IF NOT EXISTS "navi"."_trainings_new_v" (
      "id" serial PRIMARY KEY NOT NULL,
      "parent_id" integer,
      "version_seo_og_image_id" integer,
      "version_seo_focus_keyphrase_stats" jsonb,
      "version_seo_additional_fields" jsonb,
      "version_seo_json_ld" varchar,
      "version_seo_no_index" boolean DEFAULT false,
      "version_seo_no_follow" boolean DEFAULT false,
      "version_updated_at" timestamp(3) with time zone,
      "version_created_at" timestamp(3) with time zone,
      "version__status" "navi"."enum__trainings_new_v_version_status" DEFAULT 'draft',
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "snapshot" boolean,
      "published_locale" "navi"."enum__trainings_new_v_published_locale",
      "latest" boolean,
      "autosave" boolean
    );

    CREATE TABLE IF NOT EXISTS "navi"."_trainings_new_v_locales" (
      "version_name" varchar,
      "version_slug" varchar,
      "version_seo_title" varchar,
      "version_seo_meta_description" varchar,
      "version_seo_focus_keyphrase" varchar,
      "version_seo_link_keywords" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" "navi"."_locales" NOT NULL,
      "_parent_id" integer NOT NULL
    );

    ALTER TABLE "navi"."_trainings_new_v"
      ADD CONSTRAINT "_trainings_new_v_parent_id_trainings_new_id_fk"
      FOREIGN KEY ("parent_id") REFERENCES "navi"."trainings_new"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "navi"."_trainings_new_v"
      ADD CONSTRAINT "_trainings_new_v_version_seo_og_image_id_media_id_fk"
      FOREIGN KEY ("version_seo_og_image_id") REFERENCES "navi"."media"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "navi"."_trainings_new_v_locales"
      ADD CONSTRAINT "_trainings_new_v_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "navi"."_trainings_new_v"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "_trainings_new_v_parent_idx"
      ON "navi"."_trainings_new_v" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "_trainings_new_v_version_seo_version_seo_og_image_idx"
      ON "navi"."_trainings_new_v" USING btree ("version_seo_og_image_id");
    CREATE INDEX IF NOT EXISTS "_trainings_new_v_version_version_updated_at_idx"
      ON "navi"."_trainings_new_v" USING btree ("version_updated_at");
    CREATE INDEX IF NOT EXISTS "_trainings_new_v_version_version_created_at_idx"
      ON "navi"."_trainings_new_v" USING btree ("version_created_at");
    CREATE INDEX IF NOT EXISTS "_trainings_new_v_version_version__status_idx"
      ON "navi"."_trainings_new_v" USING btree ("version__status");
    CREATE INDEX IF NOT EXISTS "_trainings_new_v_created_at_idx"
      ON "navi"."_trainings_new_v" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "_trainings_new_v_updated_at_idx"
      ON "navi"."_trainings_new_v" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "_trainings_new_v_snapshot_idx"
      ON "navi"."_trainings_new_v" USING btree ("snapshot");
    CREATE INDEX IF NOT EXISTS "_trainings_new_v_published_locale_idx"
      ON "navi"."_trainings_new_v" USING btree ("published_locale");
    CREATE INDEX IF NOT EXISTS "_trainings_new_v_latest_idx"
      ON "navi"."_trainings_new_v" USING btree ("latest");
    CREATE INDEX IF NOT EXISTS "_trainings_new_v_autosave_idx"
      ON "navi"."_trainings_new_v" USING btree ("autosave");
    CREATE UNIQUE INDEX IF NOT EXISTS "_trainings_new_v_locales_locale_parent_id_unique"
      ON "navi"."_trainings_new_v_locales" USING btree ("_locale", "_parent_id");

    -- Convert all _locale columns to the Payload locale enum.
    ALTER TABLE "navi"."pages_locales" ALTER COLUMN "_locale" SET DATA TYPE "navi"."_locales" USING "_locale"::"navi"."_locales";
    ALTER TABLE "navi"."_pages_v_locales" ALTER COLUMN "_locale" SET DATA TYPE "navi"."_locales" USING "_locale"::"navi"."_locales";
    ALTER TABLE "navi"."posts_new_faqs_locales" ALTER COLUMN "_locale" SET DATA TYPE "navi"."_locales" USING "_locale"::"navi"."_locales";
    ALTER TABLE "navi"."posts_new_locales" ALTER COLUMN "_locale" SET DATA TYPE "navi"."_locales" USING "_locale"::"navi"."_locales";
    ALTER TABLE "navi"."tags_new_faqs_locales" ALTER COLUMN "_locale" SET DATA TYPE "navi"."_locales" USING "_locale"::"navi"."_locales";
    ALTER TABLE "navi"."tags_new_locales" ALTER COLUMN "_locale" SET DATA TYPE "navi"."_locales" USING "_locale"::"navi"."_locales";
    ALTER TABLE "navi"."team_new_faqs_locales" ALTER COLUMN "_locale" SET DATA TYPE "navi"."_locales" USING "_locale"::"navi"."_locales";
    ALTER TABLE "navi"."team_new_locales" ALTER COLUMN "_locale" SET DATA TYPE "navi"."_locales" USING "_locale"::"navi"."_locales";
    ALTER TABLE "navi"."certificates_new_locales" ALTER COLUMN "_locale" SET DATA TYPE "navi"."_locales" USING "_locale"::"navi"."_locales";
    ALTER TABLE "navi"."trainings_new_locales" ALTER COLUMN "_locale" SET DATA TYPE "navi"."_locales" USING "_locale"::"navi"."_locales";
    ALTER TABLE "navi"."_trainings_new_v_locales" ALTER COLUMN "_locale" SET DATA TYPE "navi"."_locales" USING "_locale"::"navi"."_locales";
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Revert _locale columns to varchar before dropping the enum.
    ALTER TABLE "navi"."pages_locales" ALTER COLUMN "_locale" SET DATA TYPE varchar;
    ALTER TABLE "navi"."_pages_v_locales" ALTER COLUMN "_locale" SET DATA TYPE varchar;
    ALTER TABLE "navi"."posts_new_faqs_locales" ALTER COLUMN "_locale" SET DATA TYPE varchar;
    ALTER TABLE "navi"."posts_new_locales" ALTER COLUMN "_locale" SET DATA TYPE varchar;
    ALTER TABLE "navi"."tags_new_faqs_locales" ALTER COLUMN "_locale" SET DATA TYPE varchar;
    ALTER TABLE "navi"."tags_new_locales" ALTER COLUMN "_locale" SET DATA TYPE varchar;
    ALTER TABLE "navi"."team_new_faqs_locales" ALTER COLUMN "_locale" SET DATA TYPE varchar;
    ALTER TABLE "navi"."team_new_locales" ALTER COLUMN "_locale" SET DATA TYPE varchar;
    ALTER TABLE "navi"."certificates_new_locales" ALTER COLUMN "_locale" SET DATA TYPE varchar;
    ALTER TABLE "navi"."trainings_new_locales" ALTER COLUMN "_locale" SET DATA TYPE varchar;
    ALTER TABLE "navi"."_trainings_new_v_locales" ALTER COLUMN "_locale" SET DATA TYPE varchar;

    -- Drop version tables added in up().
    DROP TABLE IF EXISTS "navi"."_trainings_new_v_locales";
    DROP TABLE IF EXISTS "navi"."_trainings_new_v";

    -- Drop enums. These are no longer referenced after column reversion.
    DROP TYPE IF EXISTS "navi"."enum__trainings_new_v_published_locale";
    DROP TYPE IF EXISTS "navi"."enum__trainings_new_v_version_status";
    DROP TYPE IF EXISTS "navi"."_locales";
  `)
}
