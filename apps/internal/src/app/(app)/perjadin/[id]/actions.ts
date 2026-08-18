"use server";

import { requirePerson } from "-/lib/person";
import { staffSurface } from "-/lib/staff-surface";
import {
  filePerjadinEvaluation,
  movePerjadinDates,
  replacePerjadinGroup,
  updatePerjadinLogistics,
  type FilePerjadinEvaluationResult,
  type MovePerjadinDatesResult,
  type NewPerjadinEvaluation,
  type PerjadinLogisticsInput,
  type PlannedTeacher,
  type ReplaceGroupResult,
  type UpdatePerjadinLogisticsResult,
} from "@sugt/db/queries";
import { revalidatePath } from "next/cache";

/**
 * **Substituting the Group on a trip that already exists.**
 *
 * It lives beside the page that calls it rather than beside Rencanakan Perjadin's write,
 * which is the same rule `/sesi/[id]/actions.ts` follows: an action belongs to the route
 * that offers it. That also keeps `revalidatePath` honest — a route's action revalidating
 * some other route is a sign it is in the wrong file.
 *
 * It opens no transaction and re-checks no role. The boundary is convention 5's and lives
 * in `replacePerjadinGroup`, where a Group is deleted and re-inserted as one act; and
 * `requireStaff` inside it is what actually closes the path, since a layout does not run
 * before a Server Action.
 *
 * Every refusal comes back as a value. A Group missing a Stream, or one professor named on
 * both, is something a person can submit honestly, and each earns a field-level message
 * rather than an error page.
 */
export async function replacePerjadinGroupAction(
  perjadinId: string,
  teachers: PlannedTeacher[],
  extraStaffPersonIds: string[] = [],
): Promise<ReplaceGroupResult> {
  const person = await requirePerson();

  const result = await staffSurface(() =>
    replacePerjadinGroup(person, perjadinId, teachers, extraStaffPersonIds),
  );
  // The page the user is looking at was just rewritten, so its payload is already in the
  // browser's router cache and would otherwise be re-shown unchanged.
  if (result.outcome === "replaced") revalidatePath(`/perjadin/${perjadinId}`);
  return result;
}

/**
 * **File a Perjadin Evaluation** — a Group member's account of how the trip went.
 *
 * No `staffSurface`, unlike the substitution above: a Perjadin Evaluation is not Staff-only
 * (ADR-0004 — it carries no money), and `filePerjadinEvaluation` returns `not-a-group-member`
 * as a value rather than throwing. The caller is still resolved, and the query holds the
 * membership rule. `revalidatePath` is called on the outcome that wrote one.
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
 * **Correct a Perjadin's dates**, moving its arranged Sessions with them.
 *
 * Staff-only, so it is wrapped in `staffSurface` for the same reason `replacePerjadinGroupAction`
 * is: `movePerjadinDates` throws `NotStaffError`, and a Server Action's error is sanitized on the
 * way to the client, so the translation to a 403 has to happen here on the server.
 *
 * The cascade also rewrites `held_on` on the trip's arranged Sessions, which `/sesi/[id]` and
 * `/sekolah/[slug]` render — but only `/perjadin/${perjadinId}` is revalidated, following the
 * convention this file's first action states: a route's action revalidating some other route is a
 * sign it is in the wrong file. Those pages re-read on their own next visit.
 */
export async function movePerjadinDatesAction(
  perjadinId: string,
  startsOn: string,
  endsOn: string,
): Promise<MovePerjadinDatesResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => movePerjadinDates(person, perjadinId, startsOn, endsOn));
  if (result.outcome === "moved") revalidatePath(`/perjadin/${perjadinId}`);
  return result;
}

/**
 * **Correct a Perjadin's departure/return logistics.** Staff-only, wrapped in `staffSurface` for
 * the same reason `movePerjadinDatesAction` is — `updatePerjadinLogistics` throws `NotStaffError`,
 * sanitized on the way to the client, so the 403 translation happens here.
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
