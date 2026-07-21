import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "navi"."posts_new"
      ADD COLUMN IF NOT EXISTS "localization_workflow_image_prompt" varchar,
      ADD COLUMN IF NOT EXISTS "localization_workflow_regenerate_image" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "localization_workflow_generated_image_model" varchar,
      ADD COLUMN IF NOT EXISTS "localization_workflow_last_image_generated_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "navi"."posts_new"
      DROP COLUMN IF EXISTS "localization_workflow_image_prompt",
      DROP COLUMN IF EXISTS "localization_workflow_regenerate_image",
      DROP COLUMN IF EXISTS "localization_workflow_generated_image_model",
      DROP COLUMN IF EXISTS "localization_workflow_last_image_generated_at";
  `)
}
