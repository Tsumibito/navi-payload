import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "navi"."leads" (
      "id" serial PRIMARY KEY NOT NULL,
      "email" varchar NOT NULL,
      "kind" varchar NOT NULL,
      "status" varchar DEFAULT 'new' NOT NULL,
      "first_name" varchar,
      "last_name" varchar,
      "phone" varchar,
      "message" varchar,
      "locale" varchar,
      "source_url" varchar,
      "utm" varchar,
      "ip" varchar,
      "user_agent" varchar,
      "consent_at" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "leads_email_idx" ON "navi"."leads" USING btree ("email");
    CREATE INDEX IF NOT EXISTS "leads_kind_idx" ON "navi"."leads" USING btree ("kind");
    CREATE INDEX IF NOT EXISTS "leads_status_idx" ON "navi"."leads" USING btree ("status");
    CREATE INDEX IF NOT EXISTS "leads_updated_at_idx" ON "navi"."leads" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "leads_created_at_idx" ON "navi"."leads" USING btree ("created_at");
    ALTER TABLE "navi"."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "leads_id" integer;
    DO $$ BEGIN
      ALTER TABLE "navi"."payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_leads_fk"
        FOREIGN KEY ("leads_id") REFERENCES "navi"."leads"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_leads_id_idx"
      ON "navi"."payload_locked_documents_rels" USING btree ("leads_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "navi"."payload_locked_documents_rels_leads_id_idx";
    ALTER TABLE "navi"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_leads_fk";
    ALTER TABLE "navi"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "leads_id";
    DROP TABLE IF EXISTS "navi"."leads" CASCADE;
  `)
}
