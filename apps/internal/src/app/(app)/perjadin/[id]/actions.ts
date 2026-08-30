"use server";

import { requirePerson } from "-/lib/person";
import { staffSurface } from "-/lib/staff-surface";
import {
  addPerjadinSession,
  addPerjadinTeacher,
  cancelSession,
  changePerjadinPic,
  editPerjadinSession,
  filePerjadinEvaluation,
  removePerjadinTeacher,
  renamePerjadinTeacher,
  setPerjadinPimpinan,
  setPerjadinStaff,
  togglePreparationItem,
  updatePerjadinLogistics,
  type AddPerjadinSessionResult,
  type AddPerjadinTeacherResult,
  type CancelSessionResult,
  type ChangePerjadinPicResult,
  type EditPerjadinSessionResult,
  type FilePerjadinEvaluationResult,
  type NewPerjadinEvaluation,
  type PerjadinLogisticsInput,
  type PerjadinSessionInput,
  type RemovePerjadinTeacherResult,
  type RenamePerjadinTeacherResult,
  type SetPerjadinPimpinanResult,
  type SetPerjadinStaffResult,
  type TogglePreparationItemResult,
  type UpdatePerjadinLogisticsResult,
} from "@sugt/db/queries";
import { revalidatePath } from "next/cache";

/**
 * **The writes Detail Perjadin offers, each beside the page that offers it.**
 *
 * An action belongs to the route that offers it — the same rule `/sesi/[id]/actions.ts` follows —
 * which is also what keeps `revalidatePath` honest: a route's action revalidating some other route
 * is a sign it is in the wrong file. Every Staff-only write is wrapped in `staffSurface`, because the
 * query throws `NotStaffError` and a Server Action's error is sanitized on the way to the client, so
 * the translation to a 403 has to happen here on the server. Every refusal a person can reach
 * honestly comes back as a value the client renders.
 */

/** **Set the Group's extra Staff** — the PIC plus this set, and nobody else. */
export async function setPerjadinStaffAction(
  perjadinId: string,
  staffPersonIds: string[],
): Promise<SetPerjadinStaffResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => setPerjadinStaff(person, perjadinId, staffPersonIds));
  if (result.outcome === "set") revalidatePath(`/perjadin/${perjadinId}`);
  return result;
}

/** **Reassign the PIC**, keeping the Group valid in one transaction. */
export async function changePerjadinPicAction(
  perjadinId: string,
  newPicPersonId: string,
): Promise<ChangePerjadinPicResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => changePerjadinPic(person, perjadinId, newPicPersonId));
  if (result.outcome === "changed") revalidatePath(`/perjadin/${perjadinId}`);
  return result;
}

/** **Set the Pimpinan recorded on the trip** — a subset of the fixed three. */
export async function setPerjadinPimpinanAction(
  perjadinId: string,
  names: string[],
): Promise<SetPerjadinPimpinanResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => setPerjadinPimpinan(person, perjadinId, names));
  if (result.outcome === "set") revalidatePath(`/perjadin/${perjadinId}`);
  return result;
}

/**
 * **Add one trip-scoped teacher name.** The teacher writes clear the "Pengajar sudah lengkap"
 * Preparation tick, which shows on the `/perjadin` list's `Persiapan: x/N` pill — so, like
 * `togglePreparationItemAction`, this revalidates both routes.
 */
export async function addPerjadinTeacherAction(
  perjadinId: string,
  name: string,
): Promise<AddPerjadinTeacherResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => addPerjadinTeacher(person, perjadinId, name));
  if (result.outcome === "added") {
    revalidatePath(`/perjadin/${perjadinId}`);
    revalidatePath("/perjadin");
  }
  return result;
}

/**
 * **Rename one trip-scoped teacher name.** `perjadinId` is passed for revalidation only — the query
 * takes the teacher's id and reads the trip back from it.
 */
export async function renamePerjadinTeacherAction(
  perjadinId: string,
  teacherId: string,
  name: string,
): Promise<RenamePerjadinTeacherResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => renamePerjadinTeacher(person, teacherId, name));
  if (result.outcome === "renamed") {
    revalidatePath(`/perjadin/${perjadinId}`);
    revalidatePath("/perjadin");
  }
  return result;
}

/** **Remove one trip-scoped teacher name.** Cascades its Session "Diajar oleh" links away. */
export async function removePerjadinTeacherAction(
  perjadinId: string,
  teacherId: string,
): Promise<RemovePerjadinTeacherResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => removePerjadinTeacher(person, teacherId));
  if (result.outcome === "removed") {
    revalidatePath(`/perjadin/${perjadinId}`);
    revalidatePath("/perjadin");
  }
  return result;
}

/** **Add one offline Session to the trip.** */
export async function addPerjadinSessionAction(
  perjadinId: string,
  input: PerjadinSessionInput,
): Promise<AddPerjadinSessionResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => addPerjadinSession(person, perjadinId, input));
  if (result.outcome === "added") revalidatePath(`/perjadin/${perjadinId}`);
  return result;
}

/** **Edit one arranged offline Session's School, date, time, Stream and "Diajar oleh".** */
export async function editPerjadinSessionAction(
  perjadinId: string,
  sessionId: string,
  input: PerjadinSessionInput,
): Promise<EditPerjadinSessionResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => editPerjadinSession(person, sessionId, input));
  if (result.outcome === "edited") revalidatePath(`/perjadin/${perjadinId}`);
  return result;
}

/** **Cancel one offline Session** — the way a Session is removed from the trip, kept visible. */
export async function cancelPerjadinSessionAction(
  perjadinId: string,
  sessionId: string,
  reason: string,
): Promise<CancelSessionResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => cancelSession(person, sessionId, reason));
  if (result.outcome === "cancelled") revalidatePath(`/perjadin/${perjadinId}`);
  return result;
}

/**
 * **File a Perjadin Evaluation** — a Group member's account of how the trip went.
 *
 * No `staffSurface`, unlike the writes above: a Perjadin Evaluation is not Staff-only (ADR-0004 — it
 * carries no money), and `filePerjadinEvaluation` returns `not-a-group-member` as a value rather than
 * throwing. The caller is still resolved, and the query holds the membership rule.
 */
export async function filePerjadinEvaluationAction(
  input: NewPerjadinEvaluation,
): Promise<FilePerjadinEvaluationResult> {
  const person = await requirePerson();

  const result = await filePerjadinEvaluation(person, input);
  if (result.outcome === "filed") revalidatePath(`/perjadin/${input.perjadinId}`);
  return result;
}

/**
 * **Correct a Perjadin's departure/return logistics** — and, with them, its date range.
 *
 * The range is the leg dates now (ADR-0021), so this write resizes `starts_on`/`ends_on` too. It
 * clamps rather than shifting: an edit that would strand an arranged Session comes back as
 * `would-strand` and nothing moves.
 */
export async function updatePerjadinLogisticsAction(
  perjadinId: string,
  input: PerjadinLogisticsInput,
): Promise<UpdatePerjadinLogisticsResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => updatePerjadinLogistics(person, perjadinId, input));
  if (result.outcome === "updated") revalidatePath(`/perjadin/${perjadinId}`);
  return result;
}

/**
 * **Tick or un-tick one Preparation Checklist box.**
 *
 * **This revalidates two routes**, which the convention otherwise forbids. The `/perjadin` list
 * carries a `Persiapan: x/N` pill genuinely derived from this write, so the list is stale the moment
 * a box is ticked from the detail page — a deliberate exception, not a route's action reaching into
 * an unrelated one.
 */
export async function togglePreparationItemAction(
  perjadinId: string,
  itemKey: string,
  checked: boolean,
): Promise<TogglePreparationItemResult> {
  const person = await requirePerson();

  const result = await staffSurface(() =>
    togglePreparationItem(person, { perjadinId, itemKey, checked }),
  );
  if (result.outcome === "toggled") {
    revalidatePath(`/perjadin/${perjadinId}`);
    revalidatePath("/perjadin");
  }
  return result;
}
