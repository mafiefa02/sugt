CREATE TABLE "sub_cluster" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"cluster_id" uuid NOT NULL,
	CONSTRAINT "sub_cluster_slug_unique" UNIQUE("slug"),
	CONSTRAINT "sub_cluster_id_cluster_id_unique" UNIQUE("id","cluster_id")
);
--> statement-breakpoint
ALTER TABLE "province" ADD COLUMN "time_zone" text;--> statement-breakpoint
-- Backfill the fifteen seeded Provinces, then tighten to NOT NULL. Hand-written because
-- drizzle-kit emits `ADD COLUMN … NOT NULL`, which is unrunnable against a database that
-- already holds the seed — the column has no default and the rows have no value. These are
-- facts, not judgement: no Indonesian Province straddles a Time Zone boundary. The UPDATE
-- matches nothing on a fresh database, where migrations run before `reference-data.sql`, so
-- the same statement is correct on both — which is the pair the tests check.
UPDATE "province" SET "time_zone" = CASE "code"
  WHEN 'AC' THEN 'WIB' WHEN 'SU' THEN 'WIB' WHEN 'SS' THEN 'WIB' WHEN 'BT' THEN 'WIB'
  WHEN 'JK' THEN 'WIB' WHEN 'JB' THEN 'WIB' WHEN 'JT' THEN 'WIB' WHEN 'YO' THEN 'WIB'
  WHEN 'JI' THEN 'WIB'
  WHEN 'KI' THEN 'WITA' WHEN 'KS' THEN 'WITA' WHEN 'GO' THEN 'WITA' WHEN 'SN' THEN 'WITA'
  WHEN 'MA' THEN 'WIT' WHEN 'PD' THEN 'WIT'
END WHERE "time_zone" IS NULL;--> statement-breakpoint
ALTER TABLE "province" ALTER COLUMN "time_zone" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "school" ADD COLUMN "sub_cluster_id" uuid;--> statement-breakpoint
ALTER TABLE "perjadin" ADD COLUMN "sub_cluster_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "starts_at" time NOT NULL;--> statement-breakpoint
ALTER TABLE "sub_cluster" ADD CONSTRAINT "sub_cluster_cluster_id_cluster_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."cluster"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school" ADD CONSTRAINT "school_sub_cluster_id_sub_cluster_id_fk" FOREIGN KEY ("sub_cluster_id") REFERENCES "public"."sub_cluster"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school" ADD CONSTRAINT "school_sub_cluster_id_cluster_id_sub_cluster_id_cluster_id_fk" FOREIGN KEY ("sub_cluster_id","cluster_id") REFERENCES "public"."sub_cluster"("id","cluster_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perjadin" ADD CONSTRAINT "perjadin_sub_cluster_id_sub_cluster_id_fk" FOREIGN KEY ("sub_cluster_id") REFERENCES "public"."sub_cluster"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "session_one_school_at_a_time_per_perjadin" ON "session" USING btree ("perjadin_id","held_on","starts_at") WHERE status <> 'cancelled';--> statement-breakpoint
ALTER TABLE "province" ADD CONSTRAINT "province_time_zone_check" CHECK ("province"."time_zone" in ('WIB', 'WITA', 'WIT'));