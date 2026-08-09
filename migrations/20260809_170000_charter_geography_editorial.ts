import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN CREATE TYPE "navi"."enum_geography_pages_entity_family" AS ENUM ('country','sailing_area','region','island','locality','marina'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "navi"."enum_geography_pages_status" AS ENUM ('inventory','draft','review','published','retired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "navi"."enum_sailing_routes_status" AS ENUM ('draft','review','published','retired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    ALTER TABLE "navi"."glossary_terms_translations" ADD COLUMN IF NOT EXISTS "faqs" jsonb;

    CREATE TABLE IF NOT EXISTS "navi"."geography_pages" (
      "id" serial PRIMARY KEY NOT NULL,
      "entity_id" varchar NOT NULL,
      "entity_family" "navi"."enum_geography_pages_entity_family" NOT NULL,
      "public_slug" varchar,
      "route_locked" boolean DEFAULT true NOT NULL,
      "status" "navi"."enum_geography_pages_status" DEFAULT 'inventory' NOT NULL,
      "localized_content" jsonb NOT NULL,
      "localized_seo" jsonb,
      "hero_media" jsonb,
      "landing_card" jsonb,
      "show_on_charter_landing" boolean DEFAULT false,
      "landing_order" numeric DEFAULT 100,
      "system_projection" jsonb,
      "projection_hash" varchar NOT NULL,
      "editorial_approval" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "geography_pages_entity_id_idx" ON "navi"."geography_pages" ("entity_id");
    CREATE UNIQUE INDEX IF NOT EXISTS "geography_pages_public_slug_idx" ON "navi"."geography_pages" ("public_slug");
    CREATE INDEX IF NOT EXISTS "geography_pages_status_idx" ON "navi"."geography_pages" ("status");
    CREATE INDEX IF NOT EXISTS "geography_pages_projection_hash_idx" ON "navi"."geography_pages" ("projection_hash");

    CREATE TABLE IF NOT EXISTS "navi"."sailing_routes" (
      "id" serial PRIMARY KEY NOT NULL,
      "route_id" varchar NOT NULL,
      "public_slug" varchar,
      "route_locked" boolean DEFAULT true NOT NULL,
      "status" "navi"."enum_sailing_routes_status" DEFAULT 'draft' NOT NULL,
      "region_id" integer NOT NULL,
      "departure_marina_id" integer NOT NULL,
      "localized_content" jsonb NOT NULL,
      "localized_seo" jsonb,
      "hero_media" jsonb,
      "system_projection" jsonb,
      "projection_hash" varchar NOT NULL,
      "editorial_approval" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "sailing_routes_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "navi"."geography_pages"("id") ON DELETE restrict,
      CONSTRAINT "sailing_routes_departure_marina_id_fk" FOREIGN KEY ("departure_marina_id") REFERENCES "navi"."geography_pages"("id") ON DELETE restrict
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "sailing_routes_route_id_idx" ON "navi"."sailing_routes" ("route_id");
    CREATE UNIQUE INDEX IF NOT EXISTS "sailing_routes_public_slug_idx" ON "navi"."sailing_routes" ("public_slug");
    CREATE INDEX IF NOT EXISTS "sailing_routes_status_idx" ON "navi"."sailing_routes" ("status");
    CREATE INDEX IF NOT EXISTS "sailing_routes_projection_hash_idx" ON "navi"."sailing_routes" ("projection_hash");

    INSERT INTO "navi"."geography_pages" (
      "entity_id", "entity_family", "public_slug", "route_locked", "status",
      "localized_content", "localized_seo", "landing_card", "show_on_charter_landing",
      "landing_order", "system_projection", "projection_hash", "editorial_approval"
    ) VALUES
      (
        'region:saronic-gulf', 'region', 'yacht-charter/greece/saronic-gulf', true, 'published',
        '{"ru":{"title":"Яхтенный чартер в Сароническом заливе"},"ua":{"title":"Яхтовий чартер у Саронічній затоці"},"en":{"title":"Yacht charter in the Saronic Gulf"}}'::jsonb,
        '{"ru":{"primaryIntent":"аренда яхты в Сароническом заливе"},"ua":{"primaryIntent":"оренда яхти у Саронічній затоці"},"en":{"primaryIntent":"Saronic Gulf yacht charter"}}'::jsonb,
        '{"image":"/media/heroes/alimos-marina-960.webp","region":{"ru":"Греция","ua":"Греція","en":"Greece"},"name":{"ru":"Саронический залив","ua":"Саронічна затока","en":"Saronic Gulf"}}'::jsonb,
        true, 10,
        '{"source":"charter-importer","scope":"region:saronic-gulf"}'::jsonb,
        'sprint-9.6a:region:saronic-gulf:v1',
        '{"approved":true,"approvedAt":"2026-08-09","scope":"pilot-publication"}'::jsonb
      ),
      (
        'marina:alimos-marina', 'marina', 'yacht-charter/greece/athens/alimos-marina', true, 'published',
        '{"ru":{"title":"Марина Алимос"},"ua":{"title":"Марина Алімос"},"en":{"title":"Alimos Marina"}}'::jsonb,
        '{"ru":{"primaryIntent":"аренда яхты в марине Алимос"},"ua":{"primaryIntent":"оренда яхти в марині Алімос"},"en":{"primaryIntent":"Alimos Marina yacht charter"}}'::jsonb,
        NULL, false, 20,
        '{"source":"charter-importer","scope":"marina:alimos-marina","baseIds":["13"]}'::jsonb,
        'sprint-9.6a:marina:alimos-marina:v1',
        '{"approved":true,"approvedAt":"2026-08-09","scope":"pilot-publication"}'::jsonb
      )
    ON CONFLICT ("entity_id") DO NOTHING;

    INSERT INTO "navi"."sailing_routes" (
      "route_id", "public_slug", "route_locked", "status", "region_id", "departure_marina_id",
      "localized_content", "localized_seo", "system_projection", "projection_hash", "editorial_approval"
    )
    SELECT
      'route:saronic-gulf:alimos-aegina-poros-hydra',
      'yacht-routes/greece/saronic-gulf/alimos-aegina-poros-hydra', true, 'published',
      region."id", marina."id",
      '{"ru":{"title":"Алимос — Эгина — Порос — Идра — Алимос"},"ua":{"title":"Алімос — Егіна — Порос — Ідра — Алімос"},"en":{"title":"Alimos — Aegina — Poros — Hydra — Alimos"}}'::jsonb,
      '{"ru":{"primaryIntent":"маршрут на яхте по Сароническому заливу"},"ua":{"primaryIntent":"маршрут на яхті Саронічною затокою"},"en":{"primaryIntent":"Saronic Gulf sailing itinerary"}}'::jsonb,
      '{"source":"editorial-pilot","geometryStatus":"editorial-not-navigational","stops":["alimos","aegina","poros","hydra"]}'::jsonb,
      'sprint-9.6a:route:alimos-aegina-poros-hydra:v1',
      '{"approved":true,"approvedAt":"2026-08-09","scope":"pilot-publication"}'::jsonb
    FROM "navi"."geography_pages" region, "navi"."geography_pages" marina
    WHERE region."entity_id" = 'region:saronic-gulf'
      AND marina."entity_id" = 'marina:alimos-marina'
    ON CONFLICT ("route_id") DO NOTHING;

    ALTER TABLE "navi"."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "geography_pages_id" integer;
    ALTER TABLE "navi"."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "sailing_routes_id" integer;
    DO $$ BEGIN ALTER TABLE "navi"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_geography_pages_fk" FOREIGN KEY ("geography_pages_id") REFERENCES "navi"."geography_pages"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "navi"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sailing_routes_fk" FOREIGN KEY ("sailing_routes_id") REFERENCES "navi"."sailing_routes"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "navi"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_sailing_routes_fk";
    ALTER TABLE "navi"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_geography_pages_fk";
    ALTER TABLE "navi"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "sailing_routes_id";
    ALTER TABLE "navi"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "geography_pages_id";
    DROP TABLE IF EXISTS "navi"."sailing_routes" CASCADE;
    DROP TABLE IF EXISTS "navi"."geography_pages" CASCADE;
    ALTER TABLE "navi"."glossary_terms_translations" DROP COLUMN IF EXISTS "faqs";
    DROP TYPE IF EXISTS "navi"."enum_sailing_routes_status";
    DROP TYPE IF EXISTS "navi"."enum_geography_pages_status";
    DROP TYPE IF EXISTS "navi"."enum_geography_pages_entity_family";
  `)
}
