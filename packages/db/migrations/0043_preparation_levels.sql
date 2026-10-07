-- #421 (ADR-0045) moves the Preparation Checklist's items from code into the database, defined at
-- three levels (semua / cluster / perjadin), and replaces the six fixed items with the company's 14
-- for every Perjadin not yet finished. The cutover lives here, not in a seed run: the remote database
-- is populated and its full seed cannot be re-applied.
--
-- 1. The tables. 2. The old six become semua items added before any Perjadin and removed today (WIB),
-- so every Perjadin that ended before today keeps them; their ticks move to the new tick table by
-- matching item_key. Ticks on keys no item ever had a row for -- the retired dosen:* and
-- tiket_keberangkatan/tiket_kepulangan -- were already invisible orphans (ADR-0018) and are dropped.
-- 3. The 14 become semua items added today, so every Perjadin ending today or later shows them, the
-- second carrying the Teaching-Team auto-untick. 4. The old tick table is dropped.
CREATE TABLE "perjadin_preparation_tick" (
	"perjadin_id" uuid NOT NULL,
	"preparation_item_id" uuid NOT NULL,
	"checked_by" uuid NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "perjadin_preparation_tick_perjadin_id_preparation_item_id_pk" PRIMARY KEY("perjadin_id","preparation_item_id")
);
--> statement-breakpoint
CREATE TABLE "preparation_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" text NOT NULL,
	"cluster_id" uuid,
	"perjadin_id" uuid,
	"label" text NOT NULL,
	"position" integer NOT NULL,
	"added_on" date,
	"removed_on" date,
	"clears_on_teaching_team_change" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preparation_item_level_check" CHECK ("preparation_item"."level" in ('semua', 'cluster', 'perjadin')),
	CONSTRAINT "preparation_item_scope_matches_level" CHECK (("preparation_item"."level" = 'semua' and "preparation_item"."cluster_id" is null and "preparation_item"."perjadin_id" is null)
        or ("preparation_item"."level" = 'cluster' and "preparation_item"."cluster_id" is not null and "preparation_item"."perjadin_id" is null)
        or ("preparation_item"."level" = 'perjadin' and "preparation_item"."perjadin_id" is not null and "preparation_item"."cluster_id" is null)),
	CONSTRAINT "preparation_item_dated_iff_wide" CHECK (("preparation_item"."level" = 'perjadin' and "preparation_item"."added_on" is null and "preparation_item"."removed_on" is null)
        or ("preparation_item"."level" <> 'perjadin' and "preparation_item"."added_on" is not null)),
	CONSTRAINT "preparation_item_removed_after_added" CHECK ("preparation_item"."removed_on" is null or "preparation_item"."removed_on" >= "preparation_item"."added_on"),
	CONSTRAINT "preparation_item_label_not_empty" CHECK (length(trim("preparation_item"."label")) > 0),
	CONSTRAINT "preparation_item_system_item_kept" CHECK (not "preparation_item"."clears_on_teaching_team_change" or ("preparation_item"."level" = 'semua' and "preparation_item"."removed_on" is null))
);
--> statement-breakpoint
CREATE TABLE "preparation_item_hide" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preparation_item_id" uuid NOT NULL,
	"cluster_id" uuid,
	"perjadin_id" uuid,
	"hidden_on" date,
	"shown_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preparation_item_hide_one_scope" CHECK (("preparation_item_hide"."cluster_id" is null) <> ("preparation_item_hide"."perjadin_id" is null)),
	CONSTRAINT "preparation_item_hide_dated_iff_cluster" CHECK (("preparation_item_hide"."cluster_id" is not null and "preparation_item_hide"."hidden_on" is not null)
        or ("preparation_item_hide"."perjadin_id" is not null and "preparation_item_hide"."hidden_on" is null and "preparation_item_hide"."shown_on" is null)),
	CONSTRAINT "preparation_item_hide_shown_after_hidden" CHECK ("preparation_item_hide"."shown_on" is null or "preparation_item_hide"."shown_on" >= "preparation_item_hide"."hidden_on")
);
--> statement-breakpoint
CREATE TABLE "preparation_item_wording" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preparation_item_id" uuid NOT NULL,
	"cluster_id" uuid,
	"perjadin_id" uuid,
	"label" text NOT NULL,
	CONSTRAINT "preparation_item_wording_one_scope" CHECK (("preparation_item_wording"."cluster_id" is null) <> ("preparation_item_wording"."perjadin_id" is null)),
	CONSTRAINT "preparation_item_wording_label_not_empty" CHECK (length(trim("preparation_item_wording"."label")) > 0)
);
--> statement-breakpoint
ALTER TABLE "perjadin_preparation_tick" ADD CONSTRAINT "perjadin_preparation_tick_perjadin_id_perjadin_id_fk" FOREIGN KEY ("perjadin_id") REFERENCES "public"."perjadin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perjadin_preparation_tick" ADD CONSTRAINT "perjadin_preparation_tick_item_fk" FOREIGN KEY ("preparation_item_id") REFERENCES "public"."preparation_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perjadin_preparation_tick" ADD CONSTRAINT "perjadin_preparation_tick_checked_by_person_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_item" ADD CONSTRAINT "preparation_item_cluster_id_cluster_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."cluster"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_item" ADD CONSTRAINT "preparation_item_perjadin_id_perjadin_id_fk" FOREIGN KEY ("perjadin_id") REFERENCES "public"."perjadin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_item_hide" ADD CONSTRAINT "preparation_item_hide_item_fk" FOREIGN KEY ("preparation_item_id") REFERENCES "public"."preparation_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_item_hide" ADD CONSTRAINT "preparation_item_hide_cluster_id_cluster_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."cluster"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_item_hide" ADD CONSTRAINT "preparation_item_hide_perjadin_id_perjadin_id_fk" FOREIGN KEY ("perjadin_id") REFERENCES "public"."perjadin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_item_wording" ADD CONSTRAINT "preparation_item_wording_item_fk" FOREIGN KEY ("preparation_item_id") REFERENCES "public"."preparation_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_item_wording" ADD CONSTRAINT "preparation_item_wording_cluster_id_cluster_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."cluster"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_item_wording" ADD CONSTRAINT "preparation_item_wording_perjadin_id_perjadin_id_fk" FOREIGN KEY ("perjadin_id") REFERENCES "public"."perjadin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "preparation_item_one_system_item" ON "preparation_item" USING btree ("clears_on_teaching_team_change") WHERE "preparation_item"."clears_on_teaching_team_change";--> statement-breakpoint
CREATE INDEX "preparation_item_cluster_id_idx" ON "preparation_item" USING btree ("cluster_id");--> statement-breakpoint
CREATE INDEX "preparation_item_perjadin_id_idx" ON "preparation_item" USING btree ("perjadin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "preparation_item_hide_one_open_per_cluster" ON "preparation_item_hide" USING btree ("preparation_item_id","cluster_id") WHERE "preparation_item_hide"."cluster_id" is not null and "preparation_item_hide"."shown_on" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "preparation_item_hide_one_per_perjadin" ON "preparation_item_hide" USING btree ("preparation_item_id","perjadin_id") WHERE "preparation_item_hide"."perjadin_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "preparation_item_wording_one_per_cluster" ON "preparation_item_wording" USING btree ("preparation_item_id","cluster_id") WHERE "preparation_item_wording"."cluster_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "preparation_item_wording_one_per_perjadin" ON "preparation_item_wording" USING btree ("preparation_item_id","perjadin_id") WHERE "preparation_item_wording"."perjadin_id" is not null;--> statement-breakpoint
WITH "retired" ("item_key", "label", "position") AS (
  VALUES
    ('sk_perjalanan', 'SK Perjalanan', 1),
    ('tiket_pp', 'Tiket / transportasi PP', 2),
    ('booking_penginapan', 'Booking penginapan', 3),
    ('transportasi_lokal', 'Konfirmasi dengan pihak transportasi lokal', 4),
    ('staff', 'Konfirmasi dengan para Pendamping', 5),
    ('pengajar_lengkap', 'Narasumber sudah lengkap', 6)
), "inserted" AS (
  INSERT INTO "preparation_item" ("level", "label", "position", "added_on", "removed_on")
  SELECT 'semua', "label", "position", DATE '2000-01-01', (now() AT TIME ZONE 'Asia/Jakarta')::date
    FROM "retired"
  RETURNING "id", "position"
)
INSERT INTO "perjadin_preparation_tick" ("perjadin_id", "preparation_item_id", "checked_by", "checked_at")
SELECT "old"."perjadin_id", "inserted"."id", "old"."checked_by", "old"."checked_at"
  FROM "perjadin_preparation_item" "old"
  JOIN "retired" ON "retired"."item_key" = "old"."item_key"
  JOIN "inserted" ON "inserted"."position" = "retired"."position";--> statement-breakpoint
INSERT INTO "preparation_item" ("level", "label", "position", "added_on", "clears_on_teaching_team_change")
SELECT 'semua', "label", "position", (now() AT TIME ZONE 'Asia/Jakarta')::date, "position" = 2
  FROM (VALUES
    (1, 'Pembagian keberangkatan/Pendamping'),
    (2, 'Fiksasi Dosen/Narasumber oleh PIC Dosen'),
    (3, 'Pembuatan grup koordinasi keberangkatan'),
    (4, 'Fiksasi itinerary oleh Ibu Direktur'),
    (5, 'Komunikasi dengan pihak sekolah oleh Pak Rahmat/Fandy di antaranya terkait kesiapan sekolah, fasilitas, dan lainnya'),
    (6, 'Menginformasikan kepada Ketua Rombongan (Dosen) oleh Pak Rahmat/Fandy'),
    (7, 'Itinerary disebarkan kepada dosen kelompok melalui Grup Keberangkatan'),
    (8, 'Pemesanan Hotel'),
    (9, 'Pemesanan Tiket Pesawat/Kereta/Travel'),
    (10, 'Barang bawaan sudah aman (RBL/Modul)'),
    (11, 'Kelengkapan dokumen sudah aman (SPPD dan Daftar Hadir Peserta/Pendamping/Narasumber)'),
    (12, 'Uang pegangan konsumsi sudah diterima'),
    (13, 'Kirim CV Narasumber ke pihak sekolah'),
    (14, 'Drive dokumentasi kegiatan dan laporan keuangan harian berupa spreadsheet/lainnya beserta dengan drive upload bukti pembelian')
  ) AS "company" ("position", "label");--> statement-breakpoint
DROP TABLE "perjadin_preparation_item" CASCADE;
