import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Curated Sprint 3A delta migration.
 *
 * The repository did not contain Payload migration history, so migrate:create
 * initially generated the complete database. The adjacent JSON file is kept as
 * the current Payload schema snapshot, while this executable migration contains
 * only the reviewed delta for an existing Navi database.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "navi"."posts_new" ADD COLUMN "public_slug" varchar;
    ALTER TABLE "navi"."tags_new" ADD COLUMN "public_slug" varchar;
    ALTER TABLE "navi"."team_new" ADD COLUMN "public_slug" varchar;
    ALTER TABLE "navi"."certificates_new" ADD COLUMN "public_slug" varchar;

    CREATE UNIQUE INDEX "posts_new_public_slug_idx"
      ON "navi"."posts_new" USING btree ("public_slug");
    CREATE UNIQUE INDEX "tags_new_public_slug_idx"
      ON "navi"."tags_new" USING btree ("public_slug");
    CREATE UNIQUE INDEX "team_new_public_slug_idx"
      ON "navi"."team_new" USING btree ("public_slug");
    CREATE UNIQUE INDEX "certificates_new_public_slug_idx"
      ON "navi"."certificates_new" USING btree ("public_slug");

    CREATE TYPE "navi"."enum_pages_page_type" AS ENUM('root', 'listing', 'static');
    CREATE TYPE "navi"."enum_pages_status" AS ENUM('draft', 'published');
    CREATE TYPE "navi"."enum__pages_v_version_page_type" AS ENUM('root', 'listing', 'static');
    CREATE TYPE "navi"."enum__pages_v_version_status" AS ENUM('draft', 'published');
    CREATE TYPE "navi"."enum__pages_v_published_locale" AS ENUM('ru', 'uk', 'en');

    CREATE TABLE "navi"."pages" (
      "id" serial PRIMARY KEY NOT NULL,
      "page_key" varchar,
      "page_type" "navi"."enum_pages_page_type" DEFAULT 'static',
      "public_slug" varchar,
      "seo_og_image_id" integer,
      "seo_focus_keyphrase_stats" jsonb,
      "seo_additional_fields" jsonb,
      "seo_json_ld" varchar,
      "seo_no_index" boolean DEFAULT false,
      "seo_no_follow" boolean DEFAULT false,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "_status" "navi"."enum_pages_status" DEFAULT 'draft'
    );

    CREATE TABLE "navi"."pages_locales" (
      "h1" varchar,
      "content" jsonb,
      "seo_title" varchar,
      "seo_meta_description" varchar,
      "seo_focus_keyphrase" varchar,
      "seo_link_keywords" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" varchar NOT NULL,
      "_parent_id" integer NOT NULL
    );

    CREATE TABLE "navi"."_pages_v" (
      "id" serial PRIMARY KEY NOT NULL,
      "parent_id" integer,
      "version_page_key" varchar,
      "version_page_type" "navi"."enum__pages_v_version_page_type" DEFAULT 'static',
      "version_public_slug" varchar,
      "version_seo_og_image_id" integer,
      "version_seo_focus_keyphrase_stats" jsonb,
      "version_seo_additional_fields" jsonb,
      "version_seo_json_ld" varchar,
      "version_seo_no_index" boolean DEFAULT false,
      "version_seo_no_follow" boolean DEFAULT false,
      "version_updated_at" timestamp(3) with time zone,
      "version_created_at" timestamp(3) with time zone,
      "version__status" "navi"."enum__pages_v_version_status" DEFAULT 'draft',
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "snapshot" boolean,
      "published_locale" "navi"."enum__pages_v_published_locale",
      "latest" boolean
    );

    CREATE TABLE "navi"."_pages_v_locales" (
      "version_h1" varchar,
      "version_content" jsonb,
      "version_seo_title" varchar,
      "version_seo_meta_description" varchar,
      "version_seo_focus_keyphrase" varchar,
      "version_seo_link_keywords" varchar,
      "id" serial PRIMARY KEY NOT NULL,
      "_locale" varchar NOT NULL,
      "_parent_id" integer NOT NULL
    );

    ALTER TABLE "navi"."pages"
      ADD CONSTRAINT "pages_seo_og_image_id_media_id_fk"
      FOREIGN KEY ("seo_og_image_id") REFERENCES "navi"."media"("id")
      ON DELETE set null ON UPDATE no action;
    ALTER TABLE "navi"."pages_locales"
      ADD CONSTRAINT "pages_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "navi"."pages"("id")
      ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "navi"."_pages_v"
      ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk"
      FOREIGN KEY ("parent_id") REFERENCES "navi"."pages"("id")
      ON DELETE set null ON UPDATE no action;
    ALTER TABLE "navi"."_pages_v"
      ADD CONSTRAINT "_pages_v_version_seo_og_image_id_media_id_fk"
      FOREIGN KEY ("version_seo_og_image_id") REFERENCES "navi"."media"("id")
      ON DELETE set null ON UPDATE no action;
    ALTER TABLE "navi"."_pages_v_locales"
      ADD CONSTRAINT "_pages_v_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "navi"."_pages_v"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE UNIQUE INDEX "pages_page_key_idx" ON "navi"."pages" USING btree ("page_key");
    CREATE UNIQUE INDEX "pages_public_slug_idx" ON "navi"."pages" USING btree ("public_slug");
    CREATE INDEX "pages_seo_seo_og_image_idx" ON "navi"."pages" USING btree ("seo_og_image_id");
    CREATE INDEX "pages_updated_at_idx" ON "navi"."pages" USING btree ("updated_at");
    CREATE INDEX "pages_created_at_idx" ON "navi"."pages" USING btree ("created_at");
    CREATE INDEX "pages__status_idx" ON "navi"."pages" USING btree ("_status");
    CREATE UNIQUE INDEX "pages_locales_locale_parent_id_unique"
      ON "navi"."pages_locales" USING btree ("_locale", "_parent_id");
    CREATE INDEX "_pages_v_parent_idx" ON "navi"."_pages_v" USING btree ("parent_id");
    CREATE INDEX "_pages_v_version_version_page_key_idx"
      ON "navi"."_pages_v" USING btree ("version_page_key");
    CREATE INDEX "_pages_v_version_version_public_slug_idx"
      ON "navi"."_pages_v" USING btree ("version_public_slug");
    CREATE INDEX "_pages_v_version_seo_version_seo_og_image_idx"
      ON "navi"."_pages_v" USING btree ("version_seo_og_image_id");
    CREATE INDEX "_pages_v_version_version_updated_at_idx"
      ON "navi"."_pages_v" USING btree ("version_updated_at");
    CREATE INDEX "_pages_v_version_version_created_at_idx"
      ON "navi"."_pages_v" USING btree ("version_created_at");
    CREATE INDEX "_pages_v_version_version__status_idx"
      ON "navi"."_pages_v" USING btree ("version__status");
    CREATE INDEX "_pages_v_created_at_idx" ON "navi"."_pages_v" USING btree ("created_at");
    CREATE INDEX "_pages_v_updated_at_idx" ON "navi"."_pages_v" USING btree ("updated_at");
    CREATE INDEX "_pages_v_snapshot_idx" ON "navi"."_pages_v" USING btree ("snapshot");
    CREATE INDEX "_pages_v_published_locale_idx"
      ON "navi"."_pages_v" USING btree ("published_locale");
    CREATE INDEX "_pages_v_latest_idx" ON "navi"."_pages_v" USING btree ("latest");
    CREATE UNIQUE INDEX "_pages_v_locales_locale_parent_id_unique"
      ON "navi"."_pages_v_locales" USING btree ("_locale", "_parent_id");

    ALTER TABLE "navi"."payload_locked_documents_rels" ADD COLUMN "pages_id" integer;
    ALTER TABLE "navi"."payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_pages_fk"
      FOREIGN KEY ("pages_id") REFERENCES "navi"."pages"("id")
      ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_pages_id_idx"
      ON "navi"."payload_locked_documents_rels" USING btree ("pages_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "navi"."payload_locked_documents_rels"
      DROP CONSTRAINT "payload_locked_documents_rels_pages_fk";
    DROP INDEX "navi"."payload_locked_documents_rels_pages_id_idx";
    ALTER TABLE "navi"."payload_locked_documents_rels" DROP COLUMN "pages_id";

    DROP TABLE "navi"."_pages_v_locales";
    DROP TABLE "navi"."_pages_v";
    DROP TABLE "navi"."pages_locales";
    DROP TABLE "navi"."pages";

    DROP TYPE "navi"."enum__pages_v_published_locale";
    DROP TYPE "navi"."enum__pages_v_version_status";
    DROP TYPE "navi"."enum__pages_v_version_page_type";
    DROP TYPE "navi"."enum_pages_status";
    DROP TYPE "navi"."enum_pages_page_type";

    DROP INDEX "navi"."certificates_new_public_slug_idx";
    DROP INDEX "navi"."team_new_public_slug_idx";
    DROP INDEX "navi"."tags_new_public_slug_idx";
    DROP INDEX "navi"."posts_new_public_slug_idx";
    ALTER TABLE "navi"."certificates_new" DROP COLUMN "public_slug";
    ALTER TABLE "navi"."team_new" DROP COLUMN "public_slug";
    ALTER TABLE "navi"."tags_new" DROP COLUMN "public_slug";
    ALTER TABLE "navi"."posts_new" DROP COLUMN "public_slug";
  `)
}
