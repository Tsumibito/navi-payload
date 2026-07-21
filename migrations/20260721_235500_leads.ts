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
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "navi"."leads" CASCADE;`)
}
