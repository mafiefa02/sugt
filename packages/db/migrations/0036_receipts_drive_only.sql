-- #379 (ADR-0040) is the contract step: every receipt is in Google Drive, so storage_path goes and
-- drive_file_id becomes NOT NULL. A row still holding only a storage_path is a receipt that
-- `drive:migrate-receipts` (#377) has not moved yet; dropping the column would lose the only pointer
-- to its bytes. So this aborts first, listing each such row, before anything is dropped. Run the
-- migration script on that database (#378), then re-run this. It passes silently on an empty or
-- fully migrated database, and the statements below then run.
DO $$
DECLARE
  unmigrated text;
BEGIN
  SELECT string_agg(format('evidence %s on transaction %s', "id", "transaction_id"),
                    E'\n' ORDER BY "id")
    INTO unmigrated
    FROM "transaction_evidence"
   WHERE "drive_file_id" IS NULL;
  IF unmigrated IS NOT NULL THEN
    RAISE EXCEPTION E'0036_receipts_drive_only: transaction_evidence rows have no drive_file_id, so their receipts are still only in the Supabase receipts bucket and dropping storage_path would lose them. Run drive:migrate-receipts on this database (#377, #378) and re-run:\n%', unmigrated;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "transaction_evidence" DROP CONSTRAINT "transaction_evidence_storage_path_unique";--> statement-breakpoint
ALTER TABLE "transaction_evidence" DROP CONSTRAINT "transaction_evidence_one_store_check";--> statement-breakpoint
ALTER TABLE "transaction_evidence" DROP CONSTRAINT "transaction_evidence_drive_content_type_check";--> statement-breakpoint
ALTER TABLE "transaction_evidence" ALTER COLUMN "drive_file_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_evidence" DROP COLUMN "storage_path";--> statement-breakpoint
ALTER TABLE "transaction_evidence" ADD CONSTRAINT "transaction_evidence_drive_content_type_check" CHECK ("transaction_evidence"."content_type" in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp'));