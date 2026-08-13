"use server";

import { requirePerson } from "-/lib/person";
import { staffSurface } from "-/lib/staff-surface";
import {
  filePerjadinEvaluation,
  replacePerjadinGroup,
  type FilePerjadinEvaluationResult,
  type NewPerjadinEvaluation,
  type PlannedTeacher,
  type ReplaceGroupResult,
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
): Promise<ReplaceGroupResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => replacePerjadinGroup(person, perjadinId, teachers));
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
