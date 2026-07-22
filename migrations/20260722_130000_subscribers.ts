import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "navi"."subscribers" (
      "id" serial PRIMARY KEY NOT NULL,
      "email" varchar NOT NULL,
      "status" varchar DEFAULT 'subscribed' NOT NULL,
      "first_name" varchar,
      "last_name" varchar,
      "locale" varchar,
      "source_url" varchar,
      "utm" varchar,
      "ip" varchar,
      "user_agent" varchar,
      "consent_at" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "subscribers_email_idx" ON "navi"."subscribers" USING btree (lower("email"));
    CREATE INDEX IF NOT EXISTS "subscribers_status_idx" ON "navi"."subscribers" USING btree ("status");
    CREATE INDEX IF NOT EXISTS "subscribers_updated_at_idx" ON "navi"."subscribers" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "subscribers_created_at_idx" ON "navi"."subscribers" USING btree ("created_at");

    INSERT INTO "navi"."subscribers" (
      "email", "status", "first_name", "last_name", "locale", "source_url", "utm",
      "ip", "user_agent", "consent_at", "updated_at", "created_at"
    )
    SELECT DISTINCT ON (lower("email"))
      lower("email"),
      CASE WHEN "status" = 'unsubscribed' THEN 'unsubscribed' ELSE 'subscribed' END,
      "first_name", "last_name", "locale", "source_url", "utm", "ip", "user_agent",
      "consent_at", "updated_at", "created_at"
    FROM "navi"."leads"
    WHERE "kind" = 'newsletter'
    ORDER BY lower("email"), "created_at" DESC
    ON CONFLICT (lower("email")) DO NOTHING;

    ALTER TABLE "navi"."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "subscribers_id" integer;
    DO $$ BEGIN
      ALTER TABLE "navi"."payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_subscribers_fk"
        FOREIGN KEY ("subscribers_id") REFERENCES "navi"."subscribers"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_subscribers_id_idx"
      ON "navi"."payload_locked_documents_rels" USING btree ("subscribers_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "navi"."payload_locked_documents_rels_subscribers_id_idx";
    ALTER TABLE "navi"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_subscribers_fk";
    ALTER TABLE "navi"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "subscribers_id";
    DROP TABLE IF EXISTS "navi"."subscribers" CASCADE;
  `)
}
