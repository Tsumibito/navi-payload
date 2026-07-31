import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "navi"."enum_payload_jobs_task_slug" ADD VALUE IF NOT EXISTS 'sync-link-index';
    ALTER TYPE "navi"."enum_payload_jobs_log_task_slug" ADD VALUE IF NOT EXISTS 'sync-link-index';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // PostgreSQL cannot remove an enum value without rebuilding the type and
  // every dependent column. Keep this migration irreversible to avoid
  // corrupting queued job history during a rollback.
}
