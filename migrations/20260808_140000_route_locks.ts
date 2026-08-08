import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "navi"."posts_new" ADD COLUMN IF NOT EXISTS "route_locked" boolean DEFAULT true NOT NULL;
    ALTER TABLE "navi"."tags_new" ADD COLUMN IF NOT EXISTS "route_locked" boolean DEFAULT true NOT NULL;
    ALTER TABLE "navi"."team_new" ADD COLUMN IF NOT EXISTS "route_locked" boolean DEFAULT true NOT NULL;
    ALTER TABLE "navi"."certificates_new" ADD COLUMN IF NOT EXISTS "route_locked" boolean DEFAULT true NOT NULL;
    ALTER TABLE "navi"."pages" ADD COLUMN IF NOT EXISTS "route_locked" boolean DEFAULT true NOT NULL;
    ALTER TABLE IF EXISTS "navi"."_team_new_v" ADD COLUMN IF NOT EXISTS "version_route_locked" boolean DEFAULT true NOT NULL;
    ALTER TABLE IF EXISTS "navi"."_pages_v" ADD COLUMN IF NOT EXISTS "version_route_locked" boolean DEFAULT true NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE IF EXISTS "navi"."_pages_v" DROP COLUMN IF EXISTS "version_route_locked";
    ALTER TABLE IF EXISTS "navi"."_team_new_v" DROP COLUMN IF EXISTS "version_route_locked";
    ALTER TABLE "navi"."pages" DROP COLUMN IF EXISTS "route_locked";
    ALTER TABLE "navi"."certificates_new" DROP COLUMN IF EXISTS "route_locked";
    ALTER TABLE "navi"."team_new" DROP COLUMN IF EXISTS "route_locked";
    ALTER TABLE "navi"."tags_new" DROP COLUMN IF EXISTS "route_locked";
    ALTER TABLE "navi"."posts_new" DROP COLUMN IF EXISTS "route_locked";
  `)
}
