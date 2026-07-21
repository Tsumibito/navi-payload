import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "navi"."trainings_new_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"certificates_new_id" integer
  );
  
  CREATE TABLE "navi"."_trainings_new_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"certificates_new_id" integer
  );
  
  ALTER TABLE "navi"."trainings_new_rels" ADD CONSTRAINT "trainings_new_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "navi"."trainings_new"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navi"."trainings_new_rels" ADD CONSTRAINT "trainings_new_rels_certificates_fk" FOREIGN KEY ("certificates_new_id") REFERENCES "navi"."certificates_new"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navi"."_trainings_new_v_rels" ADD CONSTRAINT "_trainings_new_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "navi"."_trainings_new_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navi"."_trainings_new_v_rels" ADD CONSTRAINT "_trainings_new_v_rels_certificates_fk" FOREIGN KEY ("certificates_new_id") REFERENCES "navi"."certificates_new"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "trainings_new_rels_order_idx" ON "navi"."trainings_new_rels" USING btree ("order");
  CREATE INDEX "trainings_new_rels_parent_idx" ON "navi"."trainings_new_rels" USING btree ("parent_id");
  CREATE INDEX "trainings_new_rels_path_idx" ON "navi"."trainings_new_rels" USING btree ("path");
  CREATE INDEX "trainings_new_rels_certificates_new_id_idx" ON "navi"."trainings_new_rels" USING btree ("certificates_new_id");
  CREATE INDEX "_trainings_new_v_rels_order_idx" ON "navi"."_trainings_new_v_rels" USING btree ("order");
  CREATE INDEX "_trainings_new_v_rels_parent_idx" ON "navi"."_trainings_new_v_rels" USING btree ("parent_id");
  CREATE INDEX "_trainings_new_v_rels_path_idx" ON "navi"."_trainings_new_v_rels" USING btree ("path");
  CREATE INDEX "_trainings_new_v_rels_certificates_new_id_idx" ON "navi"."_trainings_new_v_rels" USING btree ("certificates_new_id");

  -- Preserve the certificate composition already shown on the public course.
  -- Further trainings can be assigned from the Payload admin after migration.
  INSERT INTO "navi"."trainings_new_rels" ("order", "parent_id", "path", "certificates_new_id")
  SELECT certificate_order, training_id, 'certificates', certificate_id
  FROM (
    SELECT DISTINCT
      tnl._parent_id AS training_id,
      cnl._parent_id AS certificate_id,
      CASE cnl.slug WHEN 'inshore-skipper-sail' THEN 1 ELSE 2 END AS certificate_order
    FROM "navi"."trainings_new_locales" tnl
    CROSS JOIN "navi"."certificates_new_locales" cnl
    WHERE tnl.slug = 'inshore-skipper-sail'
      AND tnl._locale = 'en'
      AND cnl._locale = 'en'
      AND cnl.slug IN ('inshore-skipper-sail', 'vhf-src')
  ) seed
  ORDER BY certificate_order;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "navi"."trainings_new_rels" CASCADE;
  DROP TABLE "navi"."_trainings_new_v_rels" CASCADE;`)
}
