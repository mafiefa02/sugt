-- Session Footage (#424, ADR-0046): the photos and videos documenting one offline Session, stored in
-- the company Google Drive under a third tree, `Foto & Video/`. One table, a Drive folder id each on
-- `perjadin`, `session` and `drive_connection`, and the Activity Log's CHECK widened for the two
-- footage actions. Purely additive: nothing existing is rewritten.
CREATE TABLE "session_footage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"content_type" text NOT NULL,
	"original_filename" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"drive_file_id" text NOT NULL,
	"uploaded_by_person_id" uuid NOT NULL,
	"uploaded_by_role" text DEFAULT 'Staff' NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"drive_synced_at" timestamp with time zone,
	"drive_sync_failed_at" timestamp with time zone,
	CONSTRAINT "session_footage_drive_file_id_unique" UNIQUE("drive_file_id"),
	CONSTRAINT "session_footage_kind_check" CHECK ("session_footage"."kind" in ('foto', 'video')),
	CONSTRAINT "session_footage_content_type_check" CHECK (("session_footage"."kind" = 'foto' and "session_footage"."content_type" in ('image/jpeg', 'image/png', 'image/heic', 'image/webp')) or ("session_footage"."kind" = 'video' and "session_footage"."content_type" in ('video/mp4', 'video/quicktime'))),
	CONSTRAINT "session_footage_byte_size_check" CHECK ("session_footage"."byte_size" > 0 and "session_footage"."byte_size" <= case "session_footage"."kind" when 'foto' then 52428800 else 1048576000 end),
	CONSTRAINT "session_footage_original_filename_check" CHECK (length("session_footage"."original_filename") > 0),
	CONSTRAINT "session_footage_uploaded_by_role_check" CHECK ("session_footage"."uploaded_by_role" = 'Staff')
);
--> statement-breakpoint
ALTER TABLE "activity_log" DROP CONSTRAINT "activity_log_action_check";--> statement-breakpoint
ALTER TABLE "perjadin" ADD COLUMN "drive_footage_folder_id" text;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "drive_footage_folder_id" text;--> statement-breakpoint
ALTER TABLE "drive_connection" ADD COLUMN "footage_folder_id" text;--> statement-breakpoint
ALTER TABLE "drive_connection" ADD COLUMN "footage_pelaksanaan_offline_folder_id" text;--> statement-breakpoint
ALTER TABLE "session_footage" ADD CONSTRAINT "session_footage_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_footage" ADD CONSTRAINT "session_footage_uploaded_by_is_staff" FOREIGN KEY ("uploaded_by_person_id","uploaded_by_role") REFERENCES "public"."person"("id","role") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_footage_session_id_idx" ON "session_footage" USING btree ("session_id");--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_action_check" CHECK ("activity_log"."action" in ('advance_set', 'advance_changed', 'transaction_recorded', 'evidence_uploaded', 'report_filed', 'document_uploaded', 'document_deleted', 'footage_uploaded', 'footage_deleted'));