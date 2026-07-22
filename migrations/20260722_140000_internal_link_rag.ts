import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE EXTENSION IF NOT EXISTS vector;

    CREATE TABLE IF NOT EXISTS "navi"."link_passages" (
      "id" bigserial PRIMARY KEY,
      "post_id" integer NOT NULL REFERENCES "navi"."posts_new"("id") ON DELETE cascade,
      "locale" varchar(8) NOT NULL,
      "node_path" text NOT NULL,
      "node_type" varchar(32) NOT NULL,
      "heading" text,
      "content" text NOT NULL,
      "content_hash" varchar(64) NOT NULL,
      "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "existing_links" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "embedding_model" varchar(160) NOT NULL,
      "embedding" vector(1024) NOT NULL,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp with time zone NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "link_passages_post_locale_path_uidx"
      ON "navi"."link_passages" ("post_id", "locale", "node_path");
    CREATE INDEX IF NOT EXISTS "link_passages_post_locale_idx"
      ON "navi"."link_passages" ("post_id", "locale");
    CREATE INDEX IF NOT EXISTS "link_passages_locale_idx"
      ON "navi"."link_passages" ("locale");
    CREATE INDEX IF NOT EXISTS "link_passages_tags_gin_idx"
      ON "navi"."link_passages" USING gin ("tags");
    CREATE INDEX IF NOT EXISTS "link_passages_embedding_hnsw_idx"
      ON "navi"."link_passages" USING hnsw ("embedding" vector_cosine_ops);

    CREATE TABLE IF NOT EXISTS "navi"."internal_links" (
      "id" bigserial PRIMARY KEY,
      "source_post_id" integer NOT NULL REFERENCES "navi"."posts_new"("id") ON DELETE cascade,
      "source_locale" varchar(8) NOT NULL,
      "source_node_path" text NOT NULL,
      "source_content_hash" varchar(64) NOT NULL,
      "target_post_id" integer REFERENCES "navi"."posts_new"("id") ON DELETE cascade,
      "target_url" text NOT NULL,
      "anchor_text" text NOT NULL,
      "state" varchar(16) NOT NULL DEFAULT 'existing'
        CHECK ("state" IN ('existing', 'suggested', 'applied', 'rejected')),
      "relevance_score" double precision,
      "reason" text,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp with time zone NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "internal_links_source_anchor_target_uidx"
      ON "navi"."internal_links" ("source_post_id", "source_locale", "source_node_path", "anchor_text", "target_url");
    CREATE INDEX IF NOT EXISTS "internal_links_source_idx"
      ON "navi"."internal_links" ("source_post_id", "source_locale", "state");
    CREATE INDEX IF NOT EXISTS "internal_links_target_idx"
      ON "navi"."internal_links" ("target_post_id", "source_locale", "state");
    CREATE INDEX IF NOT EXISTS "internal_links_target_url_idx"
      ON "navi"."internal_links" ("target_url");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "navi"."internal_links" CASCADE;
    DROP TABLE IF EXISTS "navi"."link_passages" CASCADE;
    DROP EXTENSION IF EXISTS vector;
  `)
}
