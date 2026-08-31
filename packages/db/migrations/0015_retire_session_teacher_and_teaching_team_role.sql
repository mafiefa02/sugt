ALTER TABLE "session_teacher" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "session_teacher" CASCADE;--> statement-breakpoint
ALTER TABLE "person" DROP CONSTRAINT "person_role_check";--> statement-breakpoint
ALTER TABLE "group_member" DROP CONSTRAINT "group_member_stream_iff_teaching";--> statement-breakpoint
ALTER TABLE "group_member" DROP CONSTRAINT "group_member_role_check";--> statement-breakpoint
-- Data migration (T3 #153): retire the Teaching Team Person role. class_record is a
-- Teaching-Team-only table (its filed_by_role CHECK + composite FK into person(id,role))
-- and stays frozen/deferred here, so its rows cannot survive once no Person may be Teaching
-- Team — delete them (every class_record is Teaching-Team-filed by that CHECK). No-op on a
-- clean DB.
DELETE FROM "class_record" WHERE "filed_by_role" = 'Teaching Team';--> statement-breakpoint
-- group_member_person_role_fk pins a member's role to its Person's role, so neither side can
-- flip to 'Staff' alone; drop it, flip both (Teaching Team members lose their Stream too),
-- then restore it. No-op on a clean DB.
ALTER TABLE "group_member" DROP CONSTRAINT "group_member_person_role_fk";--> statement-breakpoint
UPDATE "person" SET "role" = 'Staff' WHERE "role" = 'Teaching Team';--> statement-breakpoint
UPDATE "group_member" SET "role" = 'Staff', "stream" = NULL WHERE "role" = 'Teaching Team';--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_person_role_fk" FOREIGN KEY ("person_id","role") REFERENCES "public"."person"("id","role") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_role_check" CHECK ("person"."role" = 'Staff');--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_stream_null" CHECK ("group_member"."stream" is null);--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_role_check" CHECK ("group_member"."role" = 'Staff');