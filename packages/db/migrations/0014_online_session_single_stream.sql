CREATE TABLE "session_teacher_name" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "session_offline_iff_stream";--> statement-breakpoint
DROP INDEX "session_one_online_per_school_per_day";--> statement-breakpoint
ALTER TABLE "session_teacher_name" ADD CONSTRAINT "session_teacher_name_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "session_one_online_per_school_per_day" ON "session" USING btree ("school_id","held_on","stream") WHERE perjadin_id is null and status <> 'cancelled';--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_stream_not_null" CHECK ("session"."stream" is not null);