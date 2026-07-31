import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "navi"."leads" ADD COLUMN IF NOT EXISTS "submission_id" varchar;
    UPDATE "navi"."leads" SET "submission_id" = 'legacy-lead-' || "id" WHERE "submission_id" IS NULL;
    ALTER TABLE "navi"."leads" ALTER COLUMN "submission_id" SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS "leads_submission_id_idx" ON "navi"."leads" USING btree ("submission_id");

    ALTER TABLE "navi"."subscribers" ADD COLUMN IF NOT EXISTS "submission_id" varchar;
    CREATE UNIQUE INDEX IF NOT EXISTS "subscribers_submission_id_idx" ON "navi"."subscribers" USING btree ("submission_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "navi"."subscribers_submission_id_idx";
    ALTER TABLE "navi"."subscribers" DROP COLUMN IF EXISTS "submission_id";
    DROP INDEX IF EXISTS "navi"."leads_submission_id_idx";
    ALTER TABLE "navi"."leads" DROP COLUMN IF EXISTS "submission_id";
  `)
}
