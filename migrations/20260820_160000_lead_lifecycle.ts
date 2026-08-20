import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN CREATE TYPE "navi"."enum_leads_request_kind" AS ENUM
      ('general','training','charter','delivery','expertise');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "navi"."enum_leads_lifecycle_stage" AS ENUM
      ('inquiry','triaged','qualified','unqualified','won','lost','expired');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "navi"."enum_leads_qualification_status" AS ENUM
      ('unknown','potential','qualified','unqualified');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "navi"."enum_leads_source_channel" AS ENUM
      ('organic','direct','referral','paid','unknown');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TABLE "navi"."leads"
      ADD COLUMN IF NOT EXISTS "request_kind" "navi"."enum_leads_request_kind" DEFAULT 'general' NOT NULL,
      ADD COLUMN IF NOT EXISTS "lifecycle_stage" "navi"."enum_leads_lifecycle_stage" DEFAULT 'inquiry' NOT NULL,
      ADD COLUMN IF NOT EXISTS "qualification_status" "navi"."enum_leads_qualification_status" DEFAULT 'unknown' NOT NULL,
      ADD COLUMN IF NOT EXISTS "source_channel" "navi"."enum_leads_source_channel" DEFAULT 'unknown' NOT NULL,
      ADD COLUMN IF NOT EXISTS "requested_start_date" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "requested_end_date" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "requested_location" varchar,
      ADD COLUMN IF NOT EXISTS "party_size" numeric,
      ADD COLUMN IF NOT EXISTS "yacht_reference" varchar,
      ADD COLUMN IF NOT EXISTS "request_context" jsonb,
      ADD COLUMN IF NOT EXISTS "triaged_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "qualified_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "closed_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "loss_reason" varchar;

    CREATE INDEX IF NOT EXISTS "leads_request_kind_idx" ON "navi"."leads" ("request_kind");
    CREATE INDEX IF NOT EXISTS "leads_lifecycle_stage_idx" ON "navi"."leads" ("lifecycle_stage");
    CREATE INDEX IF NOT EXISTS "leads_source_channel_idx" ON "navi"."leads" ("source_channel");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "navi"."leads_source_channel_idx";
    DROP INDEX IF EXISTS "navi"."leads_lifecycle_stage_idx";
    DROP INDEX IF EXISTS "navi"."leads_request_kind_idx";
    ALTER TABLE "navi"."leads"
      DROP COLUMN IF EXISTS "loss_reason",
      DROP COLUMN IF EXISTS "closed_at",
      DROP COLUMN IF EXISTS "qualified_at",
      DROP COLUMN IF EXISTS "triaged_at",
      DROP COLUMN IF EXISTS "request_context",
      DROP COLUMN IF EXISTS "yacht_reference",
      DROP COLUMN IF EXISTS "party_size",
      DROP COLUMN IF EXISTS "requested_location",
      DROP COLUMN IF EXISTS "requested_end_date",
      DROP COLUMN IF EXISTS "requested_start_date",
      DROP COLUMN IF EXISTS "source_channel",
      DROP COLUMN IF EXISTS "qualification_status",
      DROP COLUMN IF EXISTS "lifecycle_stage",
      DROP COLUMN IF EXISTS "request_kind";
    DROP TYPE IF EXISTS "navi"."enum_leads_source_channel";
    DROP TYPE IF EXISTS "navi"."enum_leads_qualification_status";
    DROP TYPE IF EXISTS "navi"."enum_leads_lifecycle_stage";
    DROP TYPE IF EXISTS "navi"."enum_leads_request_kind";
  `)
}
