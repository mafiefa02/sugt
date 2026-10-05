-- #395: the Activity Log. The DDL above the backfill is drizzle-kit's; the backfill below it is
-- hand-written, deriving the two entries the existing rows already record who and when for.
-- Uang Perjalanan and Laporan history cannot be recovered: no column records who set an Advance or
-- filed a report, so those start empty. `actor_email` is the person's current email, the best
-- available; `search_text` is rendered exactly as `activityLogSearchText` renders it, with the
-- receipt cap of five written out as it stood.
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_person_id" uuid NOT NULL,
	"actor_email" text NOT NULL,
	"perjadin_id" uuid NOT NULL,
	"action" text NOT NULL,
	"details" jsonb NOT NULL,
	"search_text" text NOT NULL,
	"backfilled" boolean DEFAULT false NOT NULL,
	CONSTRAINT "activity_log_action_check" CHECK ("activity_log"."action" in ('advance_set', 'advance_changed', 'transaction_recorded', 'evidence_uploaded', 'report_filed', 'document_uploaded', 'document_deleted'))
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_person_id_person_id_fk" FOREIGN KEY ("actor_person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_perjadin_id_perjadin_id_fk" FOREIGN KEY ("perjadin_id") REFERENCES "public"."perjadin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_log_occurred_at_id_idx" ON "activity_log" USING btree ("occurred_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
-- Catat transaksi: one per existing line, at `created_at`, by `created_by_person_id`. A line and the
-- receipts recorded with it are inserted in one database transaction, so they share `now()`: the
-- receipts whose `uploaded_at` equals the line's `created_at` are the ones it was recorded with.
INSERT INTO "activity_log" ("occurred_at", "actor_person_id", "actor_email", "perjadin_id", "action", "details", "search_text", "backfilled")
SELECT
  t."created_at",
  t."created_by_person_id",
  p."email",
  t."perjadin_id",
  'transaction_recorded',
  jsonb_build_object(
    'transactionId', t."id",
    'category', t."category",
    'amountIdr', t."amount_idr",
    'participantType', t."participant_type",
    'spentOn', to_char(t."spent_on", 'YYYY-MM-DD'),
    'receiptCount', coalesce(recorded."count", 0)
  ),
  lower(
    'Catat transaksi (dari data lama) · ' || t."category"
    || ' · Rp' || replace(to_char(t."amount_idr", 'FM9,999,999,999,999,999,999'), ',', '.')
    || ' · ' || t."participant_type"
    || ' · tgl ' || to_char(t."spent_on", 'YYYY-MM-DD')
    || ' · ' || coalesce(recorded."count", 0) || ' bukti'
  ),
  true
FROM "transaction" t
JOIN "person" p ON p."id" = t."created_by_person_id"
LEFT JOIN (
  SELECT ev."transaction_id", count(*) AS "count"
  FROM "transaction_evidence" ev
  JOIN "transaction" line ON line."id" = ev."transaction_id"
  WHERE ev."uploaded_at" = line."created_at"
  GROUP BY ev."transaction_id"
) recorded ON recorded."transaction_id" = t."id";--> statement-breakpoint
-- Unggah bukti: one per later batch — every other receipt, grouped by line, uploader and
-- `uploaded_at`, since one upload's rows share `now()` too. `total` is what the line held after it.
INSERT INTO "activity_log" ("occurred_at", "actor_person_id", "actor_email", "perjadin_id", "action", "details", "search_text", "backfilled")
SELECT
  batch."uploaded_at",
  batch."uploaded_by_person_id",
  p."email",
  t."perjadin_id",
  'evidence_uploaded',
  jsonb_build_object(
    'transactionId', t."id",
    'category', t."category",
    'amountIdr', t."amount_idr",
    'spentOn', to_char(t."spent_on", 'YYYY-MM-DD'),
    'added', batch."added",
    'total', batch."total"
  ),
  lower(
    'Unggah bukti (dari data lama) · ' || t."category"
    || ' · Rp' || replace(to_char(t."amount_idr", 'FM9,999,999,999,999,999,999'), ',', '.')
    || ' · tgl ' || to_char(t."spent_on", 'YYYY-MM-DD')
    || ' · +' || batch."added" || ' bukti (kini ' || batch."total" || '/5)'
  ),
  true
FROM (
  SELECT
    ev."transaction_id",
    ev."uploaded_by_person_id",
    ev."uploaded_at",
    count(*) AS "added",
    (
      SELECT count(*)
      FROM "transaction_evidence" held
      WHERE held."transaction_id" = ev."transaction_id" AND held."uploaded_at" <= ev."uploaded_at"
    ) AS "total"
  FROM "transaction_evidence" ev
  JOIN "transaction" line ON line."id" = ev."transaction_id"
  WHERE ev."uploaded_at" <> line."created_at"
  GROUP BY ev."transaction_id", ev."uploaded_by_person_id", ev."uploaded_at"
) batch
JOIN "transaction" t ON t."id" = batch."transaction_id"
JOIN "person" p ON p."id" = batch."uploaded_by_person_id";
