-- #393: the self-declared Perjadin Evaluation role `Pengajar` is `Narasumber` now, the Teaching
-- Team's label on every internal screen (ADR-0024's amendment). Drop the CHECK, rename the stored
-- rows, then add the new CHECK — the update must sit between the two, as in 0025's Editor rename.
ALTER TABLE "perjadin_evaluation" DROP CONSTRAINT "perjadin_evaluation_filed_by_role_check";--> statement-breakpoint
UPDATE "perjadin_evaluation" SET "filed_by_role" = 'Narasumber' WHERE "filed_by_role" = 'Pengajar';--> statement-breakpoint
ALTER TABLE "perjadin_evaluation" ADD CONSTRAINT "perjadin_evaluation_filed_by_role_check" CHECK ("perjadin_evaluation"."filed_by_role" in ('Narasumber', 'Pendamping', 'Pimpinan'));
