-- #408 (ADR-0043) widens one live offline Session per School per moment from one Perjadin to every
-- Perjadin: session_no_duplicate_offline_per_school, on (school_id, held_on, starts_at), replaces
-- session_no_duplicate_offline_per_school_per_perjadin. Two trips may already hold the same School at
-- the same moment, which the wider index would refuse to build. Like 0032 this migration resolves
-- nothing itself — cancelling a real Session is a human's call — so it looks for those pairs first and
-- aborts, listing each one, before anything is dropped. Cancelled and online Sessions stay outside the
-- index and are ignored here. A human cancels one Session of each pair in the app and re-runs. The
-- check passes silently on an empty or already-unique database, and the swap below then runs.
DO $$
DECLARE
  conflicts text;
BEGIN
  SELECT string_agg(
           format('school %s, %s %s, on Perjadins %s',
                  c.school_id, c.held_on, c.starts_at, c.perjadins),
           E'\n' ORDER BY c.school_id, c.held_on, c.starts_at)
    INTO conflicts
    FROM (
      SELECT "school_id", "held_on", "starts_at",
             string_agg("perjadin_id"::text, ', ' ORDER BY "perjadin_id") AS perjadins
        FROM "session"
       WHERE "perjadin_id" IS NOT NULL
         AND "status" <> 'cancelled'
       GROUP BY "school_id", "held_on", "starts_at"
      HAVING count(*) > 1
    ) c;
  IF conflicts IS NOT NULL THEN
    RAISE EXCEPTION E'0042_school_slot_across_perjadins: live offline Sessions share a School and moment across Perjadins, which session_no_duplicate_offline_per_school refuses. Cancel one Session of each pair in the app and re-run:\n%', conflicts;
  END IF;
END $$;--> statement-breakpoint
DROP INDEX "session_no_duplicate_offline_per_school_per_perjadin";--> statement-breakpoint
CREATE UNIQUE INDEX "session_no_duplicate_offline_per_school" ON "session" USING btree ("school_id","held_on","starts_at") WHERE status <> 'cancelled' and perjadin_id is not null;