import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "navi"."enum_users_role" AS ENUM ('admin', 'editor', 'automation');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    ALTER TABLE "navi"."users" ADD COLUMN IF NOT EXISTS "role" "navi"."enum_users_role" DEFAULT 'admin' NOT NULL;
    ALTER TABLE "navi"."users" ADD COLUMN IF NOT EXISTS "enable_a_p_i_key" boolean;
    ALTER TABLE "navi"."users" ADD COLUMN IF NOT EXISTS "api_key" varchar;
    ALTER TABLE "navi"."users" ADD COLUMN IF NOT EXISTS "api_key_index" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "navi"."users" DROP COLUMN IF EXISTS "api_key_index";
    ALTER TABLE "navi"."users" DROP COLUMN IF EXISTS "api_key";
    ALTER TABLE "navi"."users" DROP COLUMN IF EXISTS "enable_a_p_i_key";
    ALTER TABLE "navi"."users" DROP COLUMN IF EXISTS "role";
    DROP TYPE IF EXISTS "navi"."enum_users_role";
  `)
}
