import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "navi"."enum_posts_new_localization_workflow_target_locales" AS ENUM('ru', 'uk', 'en');
  CREATE TYPE "navi"."enum_posts_new_localization_workflow_completed_locales" AS ENUM('ru', 'uk', 'en');
  CREATE TYPE "navi"."enum_posts_new_publication_status" AS ENUM('draft', 'localizing', 'review', 'ready', 'published');
  CREATE TYPE "navi"."enum_posts_new_localization_workflow_source_locale" AS ENUM('ru', 'uk', 'en');
  CREATE TYPE "navi"."enum_posts_new_localization_workflow_state" AS ENUM('idle', 'queued', 'running', 'review', 'failed');
  CREATE TYPE "navi"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'localize-post');
  CREATE TYPE "navi"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "navi"."enum_payload_jobs_task_slug" AS ENUM('inline', 'localize-post');
  CREATE TABLE "navi"."posts_new_localization_workflow_target_locales" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "navi"."enum_posts_new_localization_workflow_target_locales",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "navi"."posts_new_localization_workflow_completed_locales" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "navi"."enum_posts_new_localization_workflow_completed_locales",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "navi"."payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "navi"."enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "navi"."enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "navi"."payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "navi"."enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"concurrency_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "navi"."posts_new" ADD COLUMN "publication_status" "navi"."enum_posts_new_publication_status" DEFAULT 'draft' NOT NULL;
  ALTER TABLE "navi"."posts_new" ADD COLUMN "localization_workflow_source_locale" "navi"."enum_posts_new_localization_workflow_source_locale" DEFAULT 'ru' NOT NULL;
  ALTER TABLE "navi"."posts_new" ADD COLUMN "localization_workflow_auto_run" boolean DEFAULT false;
  ALTER TABLE "navi"."posts_new" ADD COLUMN "localization_workflow_state" "navi"."enum_posts_new_localization_workflow_state" DEFAULT 'idle';
  ALTER TABLE "navi"."posts_new" ADD COLUMN "localization_workflow_last_completed_at" timestamp(3) with time zone;
  ALTER TABLE "navi"."posts_new" ADD COLUMN "localization_workflow_last_error" varchar;
  ALTER TABLE "navi"."posts_new_locales" ADD COLUMN "localization_workflow_link_plan" jsonb;
  ALTER TABLE "navi"."posts_new_locales" ADD COLUMN "image_alt" varchar;
  UPDATE "navi"."posts_new"
    SET "publication_status" = CASE WHEN "id" = 27 THEN 'draft'::"navi"."enum_posts_new_publication_status" ELSE 'published'::"navi"."enum_posts_new_publication_status" END;
  INSERT INTO "navi"."posts_new_localization_workflow_target_locales" ("order", "parent_id", "value")
    SELECT locale_values."order", posts."id", locale_values."value"::"navi"."enum_posts_new_localization_workflow_target_locales"
    FROM "navi"."posts_new" posts
    CROSS JOIN (VALUES (1, 'ru'), (2, 'uk'), (3, 'en')) AS locale_values("order", "value");
  ALTER TABLE "navi"."posts_new_localization_workflow_target_locales" ADD CONSTRAINT "posts_new_localization_workflow_target_locales_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "navi"."posts_new"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navi"."posts_new_localization_workflow_completed_locales" ADD CONSTRAINT "posts_new_localization_workflow_completed_locales_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "navi"."posts_new"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navi"."payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "navi"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "posts_new_localization_workflow_target_locales_order_idx" ON "navi"."posts_new_localization_workflow_target_locales" USING btree ("order");
  CREATE INDEX "posts_new_localization_workflow_target_locales_parent_idx" ON "navi"."posts_new_localization_workflow_target_locales" USING btree ("parent_id");
  CREATE INDEX "posts_new_localization_workflow_completed_locales_order_idx" ON "navi"."posts_new_localization_workflow_completed_locales" USING btree ("order");
  CREATE INDEX "posts_new_localization_workflow_completed_locales_parent_idx" ON "navi"."posts_new_localization_workflow_completed_locales" USING btree ("parent_id");
  CREATE INDEX "payload_jobs_log_order_idx" ON "navi"."payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "navi"."payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "navi"."payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "navi"."payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "navi"."payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "navi"."payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "navi"."payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "navi"."payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "navi"."payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_concurrency_key_idx" ON "navi"."payload_jobs" USING btree ("concurrency_key");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "navi"."payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "navi"."payload_jobs" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "navi"."posts_new_localization_workflow_target_locales" CASCADE;
  DROP TABLE "navi"."posts_new_localization_workflow_completed_locales" CASCADE;
  DROP TABLE "navi"."payload_jobs_log" CASCADE;
  DROP TABLE "navi"."payload_jobs" CASCADE;
  ALTER TABLE "navi"."posts_new" DROP COLUMN "publication_status";
  ALTER TABLE "navi"."posts_new" DROP COLUMN "localization_workflow_source_locale";
  ALTER TABLE "navi"."posts_new" DROP COLUMN "localization_workflow_auto_run";
  ALTER TABLE "navi"."posts_new" DROP COLUMN "localization_workflow_state";
  ALTER TABLE "navi"."posts_new" DROP COLUMN "localization_workflow_last_completed_at";
  ALTER TABLE "navi"."posts_new" DROP COLUMN "localization_workflow_last_error";
  ALTER TABLE "navi"."posts_new_locales" DROP COLUMN "localization_workflow_link_plan";
  ALTER TABLE "navi"."posts_new_locales" DROP COLUMN "image_alt";
  DROP TYPE "navi"."enum_posts_new_localization_workflow_target_locales";
  DROP TYPE "navi"."enum_posts_new_localization_workflow_completed_locales";
  DROP TYPE "navi"."enum_posts_new_publication_status";
  DROP TYPE "navi"."enum_posts_new_localization_workflow_source_locale";
  DROP TYPE "navi"."enum_posts_new_localization_workflow_state";
  DROP TYPE "navi"."enum_payload_jobs_log_task_slug";
  DROP TYPE "navi"."enum_payload_jobs_log_state";
  DROP TYPE "navi"."enum_payload_jobs_task_slug";`)
}
