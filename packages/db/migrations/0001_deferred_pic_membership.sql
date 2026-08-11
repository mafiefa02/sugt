-- The PIC is a member of their own Group.
--
-- Hand-written because Drizzle cannot express it: `deferrable` exists on transactions
-- in drizzle-orm, but not on foreign keys. This is the only piece of the domain schema
-- that is not in src/schema/.
--
-- It has to be DEFERRABLE INITIALLY DEFERRED because `perjadin` and its `group_member`
-- rows are inserted in the same transaction and neither can go first — the Perjadin
-- names its PIC, and the PIC's membership row names the Perjadin. Checked at COMMIT,
-- the pair is consistent; checked per statement, no valid ordering exists.
--
-- Together with `perjadin_pic_is_staff` (a composite key into person(id, role), in
-- 0000) this makes both halves of the PIC rule structural: they are Staff, and they
-- are on the trip.
--
-- drizzle-kit leaves this alone. It is not in the snapshot under meta/, so `generate`
-- neither knows about it nor tries to drop it — verified by generating again with the
-- schema unchanged and getting no statements.

ALTER TABLE "perjadin"
  ADD CONSTRAINT "perjadin_pic_is_a_group_member"
  FOREIGN KEY ("id", "pic_person_id")
  REFERENCES "group_member" ("perjadin_id", "person_id")
  DEFERRABLE INITIALLY DEFERRED;
