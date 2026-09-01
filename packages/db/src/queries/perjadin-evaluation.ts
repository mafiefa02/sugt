import { CONCERN_AT_OR_BELOW, PERJADIN_ASPECTS, type PerjadinAspect } from "@sugt/domain";
import { and, eq } from "drizzle-orm";

import { db } from "../client";
import { perjadinEvaluation } from "../schema/evaluations";
import { groupMember } from "../schema/travel";
import type { Person } from "./caller";

/**
 * **The Perjadin Evaluation** — how the trip went, as against how the teaching went. Filed by
 * a member of the Group that travelled, four Aspects about the journey and none about a School.
 *
 * **Not Staff-only.** A Perjadin Evaluation carries no money, so by ADR-0004 it follows the
 * open-delivery rule — the Group who travelled are the ones who slept in the hotel. So this
 * opens with no `requireStaff`; the gate is membership of the Group, returned as a value rather
 * than thrown.
 *
 * **"Only the Group that travelled may file" is held here and only here.** `filed_by_person_id`
 * references `person`, not `group_member`, because a Group is replaced wholesale and a composite
 * foreign key into it would either block the edit or cascade every evaluation away — both tested,
 * both wrong (`docs/data-model.md`). So membership is checked at the write instead.
 *
 * The elaboration rule is the same one `session-records.ts` enforces, but **retargeted per-Aspect**
 * (#163, ADR-0023): a Rating at or below `CONCERN_AT_OR_BELOW` on Aspect X needs X's OWN Komentar,
 * checked here beside the write and by `perjadin_evaluation_low_rating_needs_prose` behind it. A
 * comment on a different Aspect no longer excuses a low one — the shared `problems` box that once
 * did is gone. **`lodging` is the one nullable Rating**: a skipped hotel needs no comment, exactly
 * as Postgres `least()` drops a NULL out of the minimum.
 */

/** Trim to the prose the CHECK counts, or `null` when only whitespace is left. */
function prose(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/** The name of the constraint that refused a write, read from both places a driver may put it. */
function constraintOf(error: unknown): string | null {
  const wrapped = error as { constraint_name?: string; cause?: { constraint_name?: string } };
  return wrapped.cause?.constraint_name ?? wrapped.constraint_name ?? null;
}

/**
 * The four Ratings on a Perjadin Evaluation. `lodging` is `null` when the Group did not stay
 * anywhere — a day trip has no hotel — and 1–10 otherwise. The other three are always given.
 */
export type PerjadinEvaluationRatings = {
  lodging: number | null;
  transport: number;
  meals: number;
  punctuality: number;
};

/**
 * One optional comment per Aspect, keyed off `PERJADIN_ASPECTS` so the form, this type and the
 * concerns query stay driven by the one list (as #102 keyed Participant Feedback off its own list).
 * Each is nullable in the row, but the per-Aspect elaboration rule below *forces* the comment for
 * any Aspect Rated low — so it belongs to the Rating it explains.
 */
export type PerjadinEvaluationComments = Record<PerjadinAspect, string | null>;

/** What the Perjadin Evaluation form collects. `null` on any Komentar the filer left blank. */
export type NewPerjadinEvaluation = {
  perjadinId: string;
  ratings: PerjadinEvaluationRatings;
  comments: PerjadinEvaluationComments;
};

export type FilePerjadinEvaluationResult =
  | { outcome: "filed"; evaluationId: string }
  /**
   * The caller was not on this Group. The database would accept the row — there is no foreign
   * key into `group_member` — so this is the rule that holds "only the Group may file", and it
   * is a value rather than a throw because a stale link is a state a correct screen can reach.
   */
  | { outcome: "not-a-group-member" }
  /**
   * A Rating of 7 or below on an Aspect whose OWN Komentar is blank.
   * `perjadin_evaluation_low_rating_needs_prose` refuses it too, per-Aspect (#163).
   */
  | { outcome: "prose-required" }
  /** This member already filed one for this Perjadin, by `perjadin_evaluation_one_per_filer`. */
  | { outcome: "already-filed" };

/**
 * File one Perjadin Evaluation.
 *
 * The membership check and the insert sit in one transaction, and the constraint catch sits
 * outside it, as `moveSessionDate` and the record writes do. There is no delivered gate and no
 * status to read — a Perjadin is always a real trip once it exists.
 */
export async function filePerjadinEvaluation(
  caller: Person,
  input: NewPerjadinEvaluation,
): Promise<FilePerjadinEvaluationResult> {
  // Trim each Komentar blank → null once, and reuse it for both the gate and the insert so the
  // rule the client sees and the row that lands agree on what counts as "said".
  const comments: PerjadinEvaluationComments = {
    lodging: prose(input.comments.lodging),
    transport: prose(input.comments.transport),
    meals: prose(input.comments.meals),
    punctuality: prose(input.comments.punctuality),
  };
  const ratings: Record<PerjadinAspect, number | null> = {
    lodging: input.ratings.lodging,
    transport: input.ratings.transport,
    meals: input.ratings.meals,
    punctuality: input.ratings.punctuality,
  };

  // Per-Aspect, not trip-wide: a low Aspect owes ITS OWN Komentar, and prose on a different
  // Aspect does not satisfy it (#163). A null `lodging` is not low — it drops out of the check
  // exactly as Postgres `least()` leaves a NULL out of the minimum — so it never demands one.
  const lowAspectLacksProse = PERJADIN_ASPECTS.some((aspect) => {
    const rating = ratings[aspect];
    return rating !== null && rating <= CONCERN_AT_OR_BELOW && comments[aspect] === null;
  });
  if (lowAspectLacksProse) return { outcome: "prose-required" };

  try {
    return await db.transaction(async (tx) => {
      const [member] = await tx
        .select({ personId: groupMember.personId })
        .from(groupMember)
        .where(
          and(eq(groupMember.perjadinId, input.perjadinId), eq(groupMember.personId, caller.id)),
        );
      if (!member) return { outcome: "not-a-group-member" };

      const [evaluation] = await tx
        .insert(perjadinEvaluation)
        .values({
          perjadinId: input.perjadinId,
          filedByPersonId: caller.id,
          lodging: input.ratings.lodging,
          transport: input.ratings.transport,
          meals: input.ratings.meals,
          punctuality: input.ratings.punctuality,
          lodgingComment: comments.lodging,
          transportComment: comments.transport,
          mealsComment: comments.meals,
          punctualityComment: comments.punctuality,
        })
        .returning({ id: perjadinEvaluation.id });

      return { outcome: "filed", evaluationId: evaluation!.id };
    });
  } catch (error) {
    if (constraintOf(error) === "perjadin_evaluation_one_per_filer") {
      return { outcome: "already-filed" };
    }
    throw error;
  }
}
