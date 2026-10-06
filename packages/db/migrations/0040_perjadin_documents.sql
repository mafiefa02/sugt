CREATE TABLE "perjadin_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"perjadin_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"document_date" date NOT NULL,
	"school_id" uuid,
	"participant_type" text,
	"starts_at" time,
	"ends_at" time,
	"drive_file_id" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"uploaded_by_person_id" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"drive_synced_at" timestamp with time zone,
	"drive_sync_failed_at" timestamp with time zone,
	CONSTRAINT "perjadin_document_drive_file_id_unique" UNIQUE("drive_file_id"),
	CONSTRAINT "perjadin_document_kind_check" CHECK ("perjadin_document"."kind" in ('Daftar Hadir Peserta', 'Daftar Hadir Narasumber', 'Daftar Hadir Pendamping')),
	CONSTRAINT "perjadin_document_participant_type_check" CHECK ("perjadin_document"."participant_type" in ('Siswa', 'GTK-MS')),
	CONSTRAINT "perjadin_document_content_type_check" CHECK ("perjadin_document"."content_type" = 'application/pdf'),
	CONSTRAINT "perjadin_document_peserta_fields_check" CHECK (("perjadin_document"."kind" = 'Daftar Hadir Peserta') = ("perjadin_document"."school_id" is not null and "perjadin_document"."participant_type" is not null and "perjadin_document"."starts_at" is not null and "perjadin_document"."ends_at" is not null)),
	CONSTRAINT "perjadin_document_other_fields_null_check" CHECK ("perjadin_document"."kind" = 'Daftar Hadir Peserta' or ("perjadin_document"."school_id" is null and "perjadin_document"."participant_type" is null and "perjadin_document"."starts_at" is null and "perjadin_document"."ends_at" is null)),
	CONSTRAINT "perjadin_document_times_check" CHECK ("perjadin_document"."ends_at" > "perjadin_document"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "perjadin_document_folder" (
	"perjadin_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"drive_folder_id" text NOT NULL,
	CONSTRAINT "perjadin_document_folder_perjadin_id_kind_pk" PRIMARY KEY("perjadin_id","kind"),
	CONSTRAINT "perjadin_document_folder_kind_check" CHECK ("perjadin_document_folder"."kind" in ('Daftar Hadir Peserta', 'Daftar Hadir Narasumber', 'Daftar Hadir Pendamping'))
);
--> statement-breakpoint
ALTER TABLE "perjadin" ADD COLUMN "drive_dokumen_folder_id" text;--> statement-breakpoint
ALTER TABLE "drive_connection" ADD COLUMN "dokumen_folder_id" text;--> statement-breakpoint
ALTER TABLE "drive_connection" ADD COLUMN "dokumen_pelaksanaan_offline_folder_id" text;--> statement-breakpoint
ALTER TABLE "perjadin_document" ADD CONSTRAINT "perjadin_document_perjadin_id_perjadin_id_fk" FOREIGN KEY ("perjadin_id") REFERENCES "public"."perjadin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perjadin_document" ADD CONSTRAINT "perjadin_document_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perjadin_document" ADD CONSTRAINT "perjadin_document_uploaded_by_person_id_person_id_fk" FOREIGN KEY ("uploaded_by_person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perjadin_document_folder" ADD CONSTRAINT "perjadin_document_folder_perjadin_id_perjadin_id_fk" FOREIGN KEY ("perjadin_id") REFERENCES "public"."perjadin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "perjadin_document_perjadin_id_idx" ON "perjadin_document" USING btree ("perjadin_id");