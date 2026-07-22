import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "navi"."posts_new"
      ADD COLUMN IF NOT EXISTS "localization_workflow_regenerate_social_images" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "localization_workflow_social_image_source_locale" varchar,
      ADD COLUMN IF NOT EXISTS "localization_workflow_last_social_images_generated_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "navi"."posts_new"
      DROP COLUMN IF EXISTS "localization_workflow_regenerate_social_images",
      DROP COLUMN IF EXISTS "localization_workflow_social_image_source_locale",
      DROP COLUMN IF EXISTS "localization_workflow_last_social_images_generated_at";
  `)
}
