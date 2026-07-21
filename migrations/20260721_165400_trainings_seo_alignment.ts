import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Align the legacy trainings tables with the shared SEO field used by the
 * current Payload collection. The version tables already contain these fields;
 * only the live document tables were left on the earlier schema.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "navi"."trainings_new"
      ADD COLUMN "seo_og_image_id" integer,
      ADD COLUMN "seo_focus_keyphrase_stats" jsonb,
      ADD COLUMN "seo_additional_fields" jsonb,
      ADD COLUMN "seo_no_index" boolean DEFAULT false,
      ADD COLUMN "seo_no_follow" boolean DEFAULT false;

    ALTER TABLE "navi"."trainings_new_locales"
      ADD COLUMN "seo_title" varchar,
      ADD COLUMN "seo_meta_description" varchar,
      ADD COLUMN "seo_focus_keyphrase" varchar,
      ADD COLUMN "seo_link_keywords" varchar;

    ALTER TABLE "navi"."trainings_new"
      ADD CONSTRAINT "trainings_new_seo_og_image_id_media_id_fk"
      FOREIGN KEY ("seo_og_image_id") REFERENCES "navi"."media"("id")
      ON DELETE set null ON UPDATE no action;

    CREATE INDEX "trainings_new_seo_seo_og_image_idx"
      ON "navi"."trainings_new" USING btree ("seo_og_image_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX "navi"."trainings_new_seo_seo_og_image_idx";
    ALTER TABLE "navi"."trainings_new"
      DROP CONSTRAINT "trainings_new_seo_og_image_id_media_id_fk";

    ALTER TABLE "navi"."trainings_new_locales"
      DROP COLUMN "seo_link_keywords",
      DROP COLUMN "seo_focus_keyphrase",
      DROP COLUMN "seo_meta_description",
      DROP COLUMN "seo_title";

    ALTER TABLE "navi"."trainings_new"
      DROP COLUMN "seo_no_follow",
      DROP COLUMN "seo_no_index",
      DROP COLUMN "seo_additional_fields",
      DROP COLUMN "seo_focus_keyphrase_stats",
      DROP COLUMN "seo_og_image_id";
  `)
}
