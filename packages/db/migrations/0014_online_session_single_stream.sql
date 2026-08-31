CREATE TABLE "session_teacher_name" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "session_offline_iff_stream";--> statement-breakpoint
-- Data backfill (T3 #151): legacy online Sessions predate single-Stream and hold a NULL
-- stream, which session_stream_not_null (added below) rejects. They historically carried
-- both-Stream teachers, so no single original value exists; 'STEM' is an arbitrary-but-safe
-- choice — no two null-stream Sessions share (school_id, held_on), so the widened
-- session_one_online_per_school_per_day unique index cannot collide. No-op on a clean DB.
UPDATE "session" SET "stream" = 'STEM' WHERE "stream" IS NULL;--> statement-breakpoint
DROP INDEX "session_one_online_per_school_per_day";--> statement-breakpoint
ALTER TABLE "session_teacher_name" ADD CONSTRAINT "session_teacher_name_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "session_one_online_per_school_per_day" ON "session" USING btree ("school_id","held_on","stream") WHERE perjadin_id is null and status <> 'cancelled';--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_stream_not_null" CHECK ("session"."stream" is not null);