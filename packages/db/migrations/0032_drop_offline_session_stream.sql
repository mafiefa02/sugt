-- #342 (ADR-0038) takes Stream off offline Sessions and narrows
-- session_no_duplicate_offline_per_school_per_perjadin from (perjadin_id, school_id, held_on,
-- starts_at, stream) to (perjadin_id, school_id, held_on, starts_at): one live offline Session per
-- School per moment on a trip, parallel rooms recorded as one Session. ADR-0019 allowed a STEM and a
-- Research Session at the same School and moment, so populated data may hold a live pair that the
-- narrowed index would refuse. Unlike 0028 this migration resolves nothing itself — merging or
-- cancelling a real Session is a human's call — so it looks for those pairs first and aborts, listing
-- each one, before anything is dropped. Cancelled Sessions stay outside the index and are ignored here.
-- A human resolves the listed pairs and re-runs. No-op on an empty or already-unique database.
DO $$
DECLARE
  conflicts text;
BEGIN
  SELECT string_agg(
           format('perjadin %s, school %s, %s %s (%s live Sessions)',
                  c.perjadin_id, c.school_id, c.held_on, c.starts_at, c.n),
           E'\n' ORDER BY c.perjadin_id, c.school_id, c.held_on, c.starts_at)
    INTO conflicts
    FROM (
      SELECT "perjadin_id", "school_id", "held_on", "starts_at", count(*) AS n
        FROM "session"
       WHERE "perjadin_id" IS NOT NULL
         AND "status" <> 'cancelled'
       GROUP BY "perjadin_id", "school_id", "held_on", "starts_at"
      HAVING count(*) > 1
    ) c;
  IF conflicts IS NOT NULL THEN
    RAISE EXCEPTION E'0032_drop_offline_session_stream: live offline Sessions share a School and moment on one Perjadin, which the narrowed session_no_duplicate_offline_per_school_per_perjadin refuses. Resolve each (keep one Session, cancel or move the rest) and re-run:\n%', conflicts;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "session_stream_check";--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "session_offline_stream_not_null";--> statement-breakpoint
DROP INDEX "session_no_duplicate_offline_per_school_per_perjadin";--> statement-breakpoint
CREATE UNIQUE INDEX "session_no_duplicate_offline_per_school_per_perjadin" ON "session" USING btree ("perjadin_id","school_id","held_on","starts_at") WHERE status <> 'cancelled';--> statement-breakpoint
ALTER TABLE "session" DROP COLUMN "stream";