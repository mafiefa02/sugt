ALTER TABLE "session_teacher" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "session_teacher" CASCADE;--> statement-breakpoint
ALTER TABLE "person" DROP CONSTRAINT "person_role_check";--> statement-breakpoint
ALTER TABLE "group_member" DROP CONSTRAINT "group_member_stream_iff_teaching";--> statement-breakpoint
ALTER TABLE "group_member" DROP CONSTRAINT "group_member_role_check";--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_role_check" CHECK ("person"."role" = 'Staff');--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_stream_null" CHECK ("group_member"."stream" is null);--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_role_check" CHECK ("group_member"."role" = 'Staff');