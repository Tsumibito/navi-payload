import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "navi"."enum_glossary_terms_translations_status" AS ENUM('proposed', 'approved', 'rejected');
  CREATE TYPE "navi"."enum_glossary_terms_translations_provenance" AS ENUM('manual', 'article', 'txt-source', 'pdf-source', 'agent');
  CREATE TYPE "navi"."enum_glossary_terms_domain" AS ENUM('general', 'sailing', 'navigation', 'meteorology', 'safety', 'radio', 'rigging', 'boatbuilding', 'racing', 'charter', 'certification');
  CREATE TYPE "navi"."enum_glossary_terms_status" AS ENUM('proposed', 'approved', 'deprecated');
  CREATE TABLE "navi"."glossary_terms_translations_aliases" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "navi"."glossary_terms_translations_forbidden_variants" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "navi"."glossary_terms_translations" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"locale" varchar NOT NULL,
  	"term" varchar NOT NULL,
  	"definition" varchar,
  	"usage_notes" varchar,
  	"status" "navi"."enum_glossary_terms_translations_status" DEFAULT 'proposed' NOT NULL,
  	"provenance" "navi"."enum_glossary_terms_translations_provenance" DEFAULT 'agent' NOT NULL,
  	"confidence" numeric DEFAULT 0.5
  );
  
  CREATE TABLE "navi"."glossary_terms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"canonical_key" varchar NOT NULL,
  	"domain" "navi"."enum_glossary_terms_domain" DEFAULT 'general' NOT NULL,
  	"status" "navi"."enum_glossary_terms_status" DEFAULT 'proposed' NOT NULL,
  	"editor_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "navi"."glossary_terms_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"posts_new_id" integer
  );
  
  ALTER TABLE "navi"."pages_locales" ADD COLUMN "seo_json_ld" varchar;
  ALTER TABLE "navi"."_pages_v_locales" ADD COLUMN "version_seo_json_ld" varchar;
  ALTER TABLE "navi"."posts_new_locales" ADD COLUMN "localization_workflow_inbound_link_plan" jsonb;
  ALTER TABLE "navi"."_trainings_new_v_locales" ADD COLUMN "version_seo_json_ld" varchar;
  ALTER TABLE "navi"."payload_locked_documents_rels" ADD COLUMN "glossary_terms_id" integer;
  ALTER TABLE "navi"."glossary_terms_translations_aliases" ADD CONSTRAINT "glossary_terms_translations_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "navi"."glossary_terms_translations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navi"."glossary_terms_translations_forbidden_variants" ADD CONSTRAINT "glossary_terms_translations_forbidden_variants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "navi"."glossary_terms_translations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navi"."glossary_terms_translations" ADD CONSTRAINT "glossary_terms_translations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "navi"."glossary_terms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navi"."glossary_terms_rels" ADD CONSTRAINT "glossary_terms_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "navi"."glossary_terms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navi"."glossary_terms_rels" ADD CONSTRAINT "glossary_terms_rels_posts_new_fk" FOREIGN KEY ("posts_new_id") REFERENCES "navi"."posts_new"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "glossary_terms_translations_aliases_order_idx" ON "navi"."glossary_terms_translations_aliases" USING btree ("_order");
  CREATE INDEX "glossary_terms_translations_aliases_parent_id_idx" ON "navi"."glossary_terms_translations_aliases" USING btree ("_parent_id");
  CREATE INDEX "glossary_terms_translations_forbidden_variants_order_idx" ON "navi"."glossary_terms_translations_forbidden_variants" USING btree ("_order");
  CREATE INDEX "glossary_terms_translations_forbidden_variants_parent_id_idx" ON "navi"."glossary_terms_translations_forbidden_variants" USING btree ("_parent_id");
  CREATE INDEX "glossary_terms_translations_order_idx" ON "navi"."glossary_terms_translations" USING btree ("_order");
  CREATE INDEX "glossary_terms_translations_parent_id_idx" ON "navi"."glossary_terms_translations" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "glossary_terms_canonical_key_idx" ON "navi"."glossary_terms" USING btree ("canonical_key");
  CREATE INDEX "glossary_terms_updated_at_idx" ON "navi"."glossary_terms" USING btree ("updated_at");
  CREATE INDEX "glossary_terms_created_at_idx" ON "navi"."glossary_terms" USING btree ("created_at");
  CREATE INDEX "glossary_terms_rels_order_idx" ON "navi"."glossary_terms_rels" USING btree ("order");
  CREATE INDEX "glossary_terms_rels_parent_idx" ON "navi"."glossary_terms_rels" USING btree ("parent_id");
  CREATE INDEX "glossary_terms_rels_path_idx" ON "navi"."glossary_terms_rels" USING btree ("path");
  CREATE INDEX "glossary_terms_rels_posts_new_id_idx" ON "navi"."glossary_terms_rels" USING btree ("posts_new_id");
  ALTER TABLE "navi"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_glossary_terms_fk" FOREIGN KEY ("glossary_terms_id") REFERENCES "navi"."glossary_terms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_glossary_terms_id_idx" ON "navi"."payload_locked_documents_rels" USING btree ("glossary_terms_id");
  UPDATE "navi"."pages_locales" locales SET "seo_json_ld" = parent."seo_json_ld" FROM "navi"."pages" parent WHERE locales."_parent_id" = parent."id" AND locales."seo_json_ld" IS NULL;
  UPDATE "navi"."_pages_v_locales" locales SET "version_seo_json_ld" = parent."version_seo_json_ld" FROM "navi"."_pages_v" parent WHERE locales."_parent_id" = parent."id" AND locales."version_seo_json_ld" IS NULL;
  UPDATE "navi"."posts_new_locales" locales SET "seo_json_ld" = parent."seo_json_ld" FROM "navi"."posts_new" parent WHERE locales."_parent_id" = parent."id" AND locales."seo_json_ld" IS NULL;
  UPDATE "navi"."tags_new_locales" locales SET "seo_json_ld" = parent."seo_json_ld" FROM "navi"."tags_new" parent WHERE locales."_parent_id" = parent."id" AND locales."seo_json_ld" IS NULL;
  UPDATE "navi"."team_new_locales" locales SET "seo_json_ld" = parent."seo_json_ld" FROM "navi"."team_new" parent WHERE locales."_parent_id" = parent."id" AND locales."seo_json_ld" IS NULL;
  UPDATE "navi"."certificates_new_locales" locales SET "seo_json_ld" = parent."seo_json_ld" FROM "navi"."certificates_new" parent WHERE locales."_parent_id" = parent."id" AND locales."seo_json_ld" IS NULL;
  UPDATE "navi"."trainings_new_locales" locales SET "seo_json_ld" = parent."seo_json_ld" FROM "navi"."trainings_new" parent WHERE locales."_parent_id" = parent."id" AND locales."seo_json_ld" IS NULL;
  UPDATE "navi"."_trainings_new_v_locales" locales SET "version_seo_json_ld" = parent."version_seo_json_ld" FROM "navi"."_trainings_new_v" parent WHERE locales."_parent_id" = parent."id" AND locales."version_seo_json_ld" IS NULL;
  -- Keep legacy parent JSON-LD columns for one compatibility release. The new
  -- Payload config reads localized columns; a later audited cleanup migration
  -- can remove the parent columns after rollback compatibility is no longer needed.`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "navi"."glossary_terms_translations_aliases" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "navi"."glossary_terms_translations_forbidden_variants" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "navi"."glossary_terms_translations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "navi"."glossary_terms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "navi"."glossary_terms_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "navi"."glossary_terms_translations_aliases" CASCADE;
  DROP TABLE "navi"."glossary_terms_translations_forbidden_variants" CASCADE;
  DROP TABLE "navi"."glossary_terms_translations" CASCADE;
  DROP TABLE "navi"."glossary_terms" CASCADE;
  DROP TABLE "navi"."glossary_terms_rels" CASCADE;
  ALTER TABLE "navi"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_glossary_terms_fk";
  
  DROP INDEX "navi"."payload_locked_documents_rels_glossary_terms_id_idx";
  ALTER TABLE "navi"."pages_locales" DROP COLUMN "seo_json_ld";
  ALTER TABLE "navi"."_pages_v_locales" DROP COLUMN "version_seo_json_ld";
  ALTER TABLE "navi"."posts_new_locales" DROP COLUMN "localization_workflow_inbound_link_plan";
  ALTER TABLE "navi"."_trainings_new_v_locales" DROP COLUMN "version_seo_json_ld";
  ALTER TABLE "navi"."payload_locked_documents_rels" DROP COLUMN "glossary_terms_id";
  DROP TYPE "navi"."enum_glossary_terms_translations_status";
  DROP TYPE "navi"."enum_glossary_terms_translations_provenance";
  DROP TYPE "navi"."enum_glossary_terms_domain";
  DROP TYPE "navi"."enum_glossary_terms_status";`)
}
