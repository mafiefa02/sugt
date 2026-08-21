import { MAX_TEACHING_TEAM_PER_PERJADIN } from "@sugt/domain";
import { and, eq } from "drizzle-orm";

import { db } from "../client";
import { perjadin, perjadinPreparationItem, perjadinTeacher } from "../schema/travel";
import type { Person } from "./caller";
import { requireStaff } from "./staff-only";

/**
 * **A Perjadin's Teaching Team, edited per name.** Adding, renaming and removing one trip-scoped
 * teacher name at a time on `/perjadin/[id]` (ADR-0020) — the Group's professors are no longer
 * `person` rows and no longer `group_member` rows, so there is no wholesale replacement here, only
 * these three granular writes.
 *
 * Every write is **Staff-only**, by the surface list — arranging and administering a trip is Staff's
 * ([#12](https://github.com/mafiefa02/sugt/issues/12), and see `./staff-only.ts`). Each refusal that
 * a person could reach honestly comes back as a value; `NotStaffError` is the opposite case and
 * still throws.
 *
 * **Each of the three clears the "Pengajar sudah lengkap" Preparation tick** so that changing the
 * team forces a fresh manual confirmation it is complete (the amendment to ADR-0018). This ticket
 * (#138) only issues the DELETE; the Preparation Item's *definition* and its auto-untick rendering
 * are T4 ([#139](https://github.com/mafiefa02/sugt/issues/139)). Until then the row does not exist,
 * so the DELETE is a harmless no-op — which is exactly why it is safe to write it now.
 */

/**
 * The `item_key` of the "Pengajar sudah lengkap" Preparation Item. A fixed key, written out here
 * character for character the same way `preparation-checklist.ts`'s keys are — the Teaching-Team
 * writes clear it, and T4/#139 owns the item's definition and its place in the derived list.
 */
const PENGAJAR_LENGKAP_ITEM_KEY = "pengajar_lengkap";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Clear the "Pengajar sudah lengkap" tick for one trip. A `DELETE` with no row to delete is not an
 * error, so this is a no-op until T4 defines the item and a Staff member ticks it.
 */
async function clearPengajarLengkap(tx: Tx, perjadinId: string): Promise<void> {
  await tx
    .delete(perjadinPreparationItem)
    .where(
      and(
        eq(perjadinPreparationItem.perjadinId, perjadinId),
        eq(perjadinPreparationItem.itemKey, PENGAJAR_LENGKAP_ITEM_KEY),
      ),
    );
}

export type AddPerjadinTeacherResult =
  | { outcome: "added"; teacherId: string }
  /** A blank name — caught here so it reads as a required field, not an empty `perjadin_teacher` row. */
  | { outcome: "name-required" }
  /** The trip already holds `MAX_TEACHING_TEAM_PER_PERJADIN` names — the app cap, not a DB rule. */
  | { outcome: "too-many-teachers"; count: number; limit: number }
  /** The id names no Perjadin — a stale link, which is reachable. */
  | { outcome: "no-such-perjadin" };

/**
 * Add one trip-scoped teacher name. Staff-only, capped at twenty, and clears the completeness tick.
 *
 * The cap is a count across sibling rows, so it is checked here rather than by a CHECK — and the
 * Perjadin row is locked for the transaction so two concurrent adds cannot both slip past a count of
 * nineteen.
 */
export async function addPerjadinTeacher(
  caller: Person,
  perjadinId: string,
  name: string,
): Promise<AddPerjadinTeacherResult> {
  requireStaff(caller);

  const trimmed = name.trim();
  if (trimmed === "") return { outcome: "name-required" };

  return db.transaction(async (tx) => {
    const [trip] = await tx
      .select({ id: perjadin.id })
      .from(perjadin)
      .where(eq(perjadin.id, perjadinId))
      .for("update");
    if (!trip) return { outcome: "no-such-perjadin" };

    const existing = await tx
      .select({ id: perjadinTeacher.id })
      .from(perjadinTeacher)
      .where(eq(perjadinTeacher.perjadinId, perjadinId));
    if (existing.length >= MAX_TEACHING_TEAM_PER_PERJADIN) {
      return {
        outcome: "too-many-teachers",
        count: existing.length,
        limit: MAX_TEACHING_TEAM_PER_PERJADIN,
      };
    }

    const [created] = await tx
      .insert(perjadinTeacher)
      .values({ perjadinId, name: trimmed })
      .returning({ id: perjadinTeacher.id });

    await clearPengajarLengkap(tx, perjadinId);
    return { outcome: "added", teacherId: created!.id };
  });
}

export type RenamePerjadinTeacherResult =
  | { outcome: "renamed" }
  | { outcome: "name-required" }
  /** The id names no teacher — one was removed while this page was open, say. */
  | { outcome: "no-such-teacher" };

/**
 * Rename one trip-scoped teacher name. Staff-only, and clears the completeness tick.
 *
 * A rename never disturbs a `session_teaching_team` link — those glue to the teacher's id, not its
 * text — so the set of who taught each Session is untouched. The trip to clear the tick for is read
 * back from the updated row rather than passed in.
 */
export async function renamePerjadinTeacher(
  caller: Person,
  teacherId: string,
  name: string,
): Promise<RenamePerjadinTeacherResult> {
  requireStaff(caller);

  const trimmed = name.trim();
  if (trimmed === "") return { outcome: "name-required" };

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(perjadinTeacher)
      .set({ name: trimmed })
      .where(eq(perjadinTeacher.id, teacherId))
      .returning({ perjadinId: perjadinTeacher.perjadinId });
    if (!updated) return { outcome: "no-such-teacher" };

    await clearPengajarLengkap(tx, updated.perjadinId);
    return { outcome: "renamed" };
  });
}

export type RemovePerjadinTeacherResult = { outcome: "removed" } | { outcome: "no-such-teacher" };

/**
 * Remove one trip-scoped teacher name. Staff-only, and clears the completeness tick.
 *
 * `session_teaching_team` cascades from `perjadin_teacher`, so removing a name also strips it from
 * the "Diajar oleh" of every Session it taught — a link is meaningless once the name is gone.
 */
export async function removePerjadinTeacher(
  caller: Person,
  teacherId: string,
): Promise<RemovePerjadinTeacherResult> {
  requireStaff(caller);

  return db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(perjadinTeacher)
      .where(eq(perjadinTeacher.id, teacherId))
      .returning({ perjadinId: perjadinTeacher.perjadinId });
    if (!deleted) return { outcome: "no-such-teacher" };

    await clearPengajarLengkap(tx, deleted.perjadinId);
    return { outcome: "removed" };
  });
}
