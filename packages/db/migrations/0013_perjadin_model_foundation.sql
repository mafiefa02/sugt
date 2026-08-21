CREATE TABLE "perjadin_pimpinan" (
	"perjadin_id" uuid NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "perjadin_pimpinan_perjadin_id_name_pk" PRIMARY KEY("perjadin_id","name"),
	CONSTRAINT "perjadin_pimpinan_name_check" CHECK ("perjadin_pimpinan"."name" in ('Prof. Dr. Fatimah Arofiati Noor, S.Si., M.Si.', 'Oktofa Yudha Sudrajad, S.T., M.S.M., Ph.D.', 'Dr. Anton Timur Jaelani, S.Si., M.Si.'))
);
--> statement-breakpoint
CREATE TABLE "perjadin_teacher" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"perjadin_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_teaching_team" (
	"session_id" uuid NOT NULL,
	"perjadin_teacher_id" uuid NOT NULL,
	CONSTRAINT "session_teaching_team_session_id_perjadin_teacher_id_pk" PRIMARY KEY("session_id","perjadin_teacher_id")
);
--> statement-breakpoint
DROP INDEX "session_one_per_school_per_perjadin";--> statement-breakpoint
DROP INDEX "session_one_school_at_a_time_per_perjadin";--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "stream" text;--> statement-breakpoint
ALTER TABLE "perjadin_pimpinan" ADD CONSTRAINT "perjadin_pimpinan_perjadin_id_perjadin_id_fk" FOREIGN KEY ("perjadin_id") REFERENCES "public"."perjadin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perjadin_teacher" ADD CONSTRAINT "perjadin_teacher_perjadin_id_perjadin_id_fk" FOREIGN KEY ("perjadin_id") REFERENCES "public"."perjadin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_teaching_team" ADD CONSTRAINT "session_teaching_team_session_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_teaching_team" ADD CONSTRAINT "session_teaching_team_teacher_fk" FOREIGN KEY ("perjadin_teacher_id") REFERENCES "public"."perjadin_teacher"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "session_no_duplicate_offline_per_school_per_perjadin" ON "session" USING btree ("perjadin_id","school_id","held_on","starts_at","stream") WHERE status <> 'cancelled';--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_stream_check" CHECK ("session"."stream" in ('STEM', 'Research'));--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_offline_iff_stream" CHECK (("session"."mode" = 'offline') = ("session"."stream" is not null));