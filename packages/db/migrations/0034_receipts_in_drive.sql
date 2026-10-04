ALTER TABLE "transaction_evidence" ALTER COLUMN "storage_path" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "perjadin" ADD COLUMN "drive_folder_id" text;--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "drive_folder_id" text;--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "drive_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transaction_evidence" ADD COLUMN "drive_file_id" text;--> statement-breakpoint
ALTER TABLE "transaction_evidence" ADD CONSTRAINT "transaction_evidence_drive_file_id_unique" UNIQUE("drive_file_id");--> statement-breakpoint
ALTER TABLE "transaction_evidence" ADD CONSTRAINT "transaction_evidence_one_store_check" CHECK (("transaction_evidence"."storage_path" is null) <> ("transaction_evidence"."drive_file_id" is null));--> statement-breakpoint
ALTER TABLE "transaction_evidence" ADD CONSTRAINT "transaction_evidence_drive_content_type_check" CHECK ("transaction_evidence"."drive_file_id" is null or "transaction_evidence"."content_type" in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp'));