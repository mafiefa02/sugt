DROP INDEX "participant_feedback_concerns_idx";--> statement-breakpoint
ALTER TABLE "participant_feedback" ADD COLUMN "hands_on_rbl" smallint;--> statement-breakpoint
ALTER TABLE "participant_feedback" ADD COLUMN "hands_on_rbl_comment" text;--> statement-breakpoint
ALTER TABLE "participant_feedback" ADD COLUMN "knowledge_gain" text;--> statement-breakpoint
ALTER TABLE "participant_feedback" ADD COLUMN "suggestions" text;--> statement-breakpoint
CREATE INDEX "participant_feedback_concerns_idx" ON "participant_feedback" USING btree (least(hands_on_rbl, materials, instructor, relevance)) WHERE least(hands_on_rbl, materials, instructor, relevance) <= 7;--> statement-breakpoint
ALTER TABLE "participant_feedback" ADD CONSTRAINT "participant_feedback_hands_on_rbl_check" CHECK ("participant_feedback"."hands_on_rbl" between 1 and 10);--> statement-breakpoint
ALTER TABLE "participant_feedback" ADD CONSTRAINT "participant_feedback_hands_on_rbl_student_check" CHECK ("participant_feedback"."class_kind" = 'Student' or ("participant_feedback"."hands_on_rbl" is null and "participant_feedback"."hands_on_rbl_comment" is null));