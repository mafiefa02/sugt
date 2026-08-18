ALTER TABLE "participant_feedback" ADD COLUMN "materials_comment" text;--> statement-breakpoint
ALTER TABLE "participant_feedback" ADD COLUMN "instructor_comment" text;--> statement-breakpoint
ALTER TABLE "participant_feedback" ADD COLUMN "relevance_comment" text;--> statement-breakpoint
ALTER TABLE "participant_feedback" DROP COLUMN "comment";