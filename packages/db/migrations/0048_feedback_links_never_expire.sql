-- Feedback links never expire and are never replaced (#453, ADR-0049). Both token tables change in
-- place: no row is dropped, recreated or rewritten, so every `token` string already printed or
-- shortened keeps resolving to the same Session or Perjadin. drizzle-kit cannot name the old
-- primary key, so the first statement of each pair is written by hand; `<table>_pkey` is the name
-- Postgres gave it, in every environment, because migrations 0000 and 0017 left it unnamed.
ALTER TABLE "session_feedback_token" DROP CONSTRAINT "session_feedback_token_pkey";--> statement-breakpoint
ALTER TABLE "session_feedback_token" ADD CONSTRAINT "session_feedback_token_pkey" PRIMARY KEY ("token");--> statement-breakpoint
ALTER TABLE "session_feedback_token" DROP CONSTRAINT "session_feedback_token_token_unique";--> statement-breakpoint
ALTER TABLE "session_feedback_token" ALTER COLUMN "session_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "session_feedback_token" DROP CONSTRAINT "session_feedback_token_expiry_check";--> statement-breakpoint
ALTER TABLE "session_feedback_token" DROP COLUMN "expires_at";--> statement-breakpoint
CREATE INDEX "session_feedback_token_session_id_idx" ON "session_feedback_token" USING btree ("session_id");--> statement-breakpoint
ALTER TABLE "perjadin_feedback_token" DROP CONSTRAINT "perjadin_feedback_token_pkey";--> statement-breakpoint
ALTER TABLE "perjadin_feedback_token" ADD CONSTRAINT "perjadin_feedback_token_pkey" PRIMARY KEY ("token");--> statement-breakpoint
ALTER TABLE "perjadin_feedback_token" DROP CONSTRAINT "perjadin_feedback_token_token_unique";--> statement-breakpoint
ALTER TABLE "perjadin_feedback_token" ALTER COLUMN "perjadin_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "perjadin_feedback_token" DROP CONSTRAINT "perjadin_feedback_token_expiry_check";--> statement-breakpoint
ALTER TABLE "perjadin_feedback_token" DROP COLUMN "expires_at";--> statement-breakpoint
CREATE INDEX "perjadin_feedback_token_perjadin_id_idx" ON "perjadin_feedback_token" USING btree ("perjadin_id");
