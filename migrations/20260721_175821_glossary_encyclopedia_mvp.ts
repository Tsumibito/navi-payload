import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "navi"."enum_glossary_terms_sources_reuse_policy" AS ENUM('ingest', 'attribution', 'reference-only', 'unknown');
  CREATE TYPE "navi"."enum_glossary_terms_release" AS ENUM('backlog', 'mvp', 'published');
  CREATE TABLE "navi"."glossary_terms_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"url" varchar,
  	"source_record_id" varchar,
  	"reuse_policy" "navi"."enum_glossary_terms_sources_reuse_policy" DEFAULT 'reference-only' NOT NULL,
  	"license" varchar,
  	"retrieved_at" timestamp(3) with time zone,
  	"notes" varchar
  );
  
  ALTER TABLE "navi"."glossary_terms_translations" ADD COLUMN "slug" varchar;
  ALTER TABLE "navi"."glossary_terms_translations" ADD COLUMN "encyclopedia_text" varchar;
  ALTER TABLE "navi"."glossary_terms_translations" ADD COLUMN "seo_title" varchar;
  ALTER TABLE "navi"."glossary_terms_translations" ADD COLUMN "seo_description" varchar;
  ALTER TABLE "navi"."glossary_terms_translations" ADD COLUMN "image_alt" varchar;
  ALTER TABLE "navi"."glossary_terms" ADD COLUMN "release" "navi"."enum_glossary_terms_release" DEFAULT 'backlog' NOT NULL;
  ALTER TABLE "navi"."glossary_terms" ADD COLUMN "illustration_id" integer;
  ALTER TABLE "navi"."glossary_terms_rels" ADD COLUMN "tags_new_id" integer;
  ALTER TABLE "navi"."glossary_terms_sources" ADD CONSTRAINT "glossary_terms_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "navi"."glossary_terms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "glossary_terms_sources_order_idx" ON "navi"."glossary_terms_sources" USING btree ("_order");
  CREATE INDEX "glossary_terms_sources_parent_id_idx" ON "navi"."glossary_terms_sources" USING btree ("_parent_id");
  ALTER TABLE "navi"."glossary_terms" ADD CONSTRAINT "glossary_terms_illustration_id_media_id_fk" FOREIGN KEY ("illustration_id") REFERENCES "navi"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "navi"."glossary_terms_rels" ADD CONSTRAINT "glossary_terms_rels_tags_new_fk" FOREIGN KEY ("tags_new_id") REFERENCES "navi"."tags_new"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "glossary_terms_release_idx" ON "navi"."glossary_terms" USING btree ("release");
  CREATE INDEX "glossary_terms_illustration_idx" ON "navi"."glossary_terms" USING btree ("illustration_id");
  CREATE INDEX "glossary_terms_rels_tags_new_id_idx" ON "navi"."glossary_terms_rels" USING btree ("tags_new_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "navi"."glossary_terms_sources" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "navi"."glossary_terms_sources" CASCADE;
  ALTER TABLE "navi"."glossary_terms" DROP CONSTRAINT "glossary_terms_illustration_id_media_id_fk";
  
  ALTER TABLE "navi"."glossary_terms_rels" DROP CONSTRAINT "glossary_terms_rels_tags_new_fk";
  
  DROP INDEX "navi"."glossary_terms_release_idx";
  DROP INDEX "navi"."glossary_terms_illustration_idx";
  DROP INDEX "navi"."glossary_terms_rels_tags_new_id_idx";
  ALTER TABLE "navi"."glossary_terms_translations" DROP COLUMN "slug";
  ALTER TABLE "navi"."glossary_terms_translations" DROP COLUMN "encyclopedia_text";
  ALTER TABLE "navi"."glossary_terms_translations" DROP COLUMN "seo_title";
  ALTER TABLE "navi"."glossary_terms_translations" DROP COLUMN "seo_description";
  ALTER TABLE "navi"."glossary_terms_translations" DROP COLUMN "image_alt";
  ALTER TABLE "navi"."glossary_terms" DROP COLUMN "release";
  ALTER TABLE "navi"."glossary_terms" DROP COLUMN "illustration_id";
  ALTER TABLE "navi"."glossary_terms_rels" DROP COLUMN "tags_new_id";
  DROP TYPE "navi"."enum_glossary_terms_sources_reuse_policy";
  DROP TYPE "navi"."enum_glossary_terms_release";`)
}
