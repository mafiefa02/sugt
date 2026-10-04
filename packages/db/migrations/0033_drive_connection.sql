CREATE TABLE "drive_connection" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"account_email" text NOT NULL,
	"refresh_token_ciphertext" text NOT NULL,
	"refresh_token_iv" text NOT NULL,
	"refresh_token_tag" text NOT NULL,
	"root_folder_id" text,
	"staging_folder_id" text,
	"bukti_transaksi_folder_id" text,
	"pelaksanaan_offline_folder_id" text,
	"readme_file_id" text,
	"folder_problem" text,
	"status" text NOT NULL,
	"broken_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"connected_by_person_id" uuid NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drive_connection_singleton_check" CHECK ("drive_connection"."singleton"),
	CONSTRAINT "drive_connection_status_check" CHECK ("drive_connection"."status" in ('connected', 'broken')),
	CONSTRAINT "drive_connection_broken_at_check" CHECK (("drive_connection"."status" = 'broken') = ("drive_connection"."broken_at" is not null)),
	CONSTRAINT "drive_connection_folder_problem_check" CHECK ("drive_connection"."folder_problem" in ('root-trashed', 'root-missing', 'staging-trashed', 'staging-missing', 'folders-unfinished'))
);
--> statement-breakpoint
ALTER TABLE "drive_connection" ADD CONSTRAINT "drive_connection_connected_by_person_id_person_id_fk" FOREIGN KEY ("connected_by_person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;