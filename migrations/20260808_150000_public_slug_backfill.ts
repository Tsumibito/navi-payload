import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "navi"."posts_new" AS document
    SET "public_slug" = CASE
      WHEN document."id" = 21 THEN 'vidy-parusnyh-yaht---raznovidnosti-i-otlichiya'
      ELSE locale."slug"
    END
    FROM "navi"."posts_new_locales" AS locale
    WHERE locale."_parent_id" = document."id"
      AND locale."_locale" = 'ru'
      AND document."public_slug" IS NULL;

    UPDATE "navi"."tags_new" AS document
    SET "public_slug" = locale."slug"
    FROM "navi"."tags_new_locales" AS locale
    WHERE locale."_parent_id" = document."id"
      AND locale."_locale" = 'en'
      AND document."public_slug" IS NULL;

    UPDATE "navi"."team_new"
    SET "public_slug" = CASE "id"
      WHEN 9 THEN 'evgenia-pilgun'
      WHEN 10 THEN 'andrii-gov'
      WHEN 11 THEN 'alex-burlakov'
    END
    WHERE "id" IN (9, 10, 11)
      AND "public_slug" IS NULL;

    UPDATE "navi"."certificates_new" AS document
    SET "public_slug" = locale."slug"
    FROM "navi"."certificates_new_locales" AS locale
    WHERE locale."_parent_id" = document."id"
      AND locale."_locale" = 'en'
      AND document."public_slug" IS NULL;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Public slugs are production route identifiers. A rollback must never erase
  // them automatically; URL changes require an explicit redirect migration.
}
