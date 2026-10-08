import {
  PARTICIPANT_FEEDBACK_ASPECTS,
  PARTICIPANT_FEEDBACK_ASPECTS_BY_CLASS,
  type ClassKind,
  type ParticipantFeedbackAspect,
} from "@sugt/domain";
import { asc, eq, sql } from "drizzle-orm";

import { db } from "../client";
import { session } from "../schema/delivery";
import { participantFeedback, sessionFeedbackToken } from "../schema/evaluations";
import type { ParticipantToken, Person } from "./caller";

/**
 * **Participant Feedback** — the one write path in either app with no signed-in Person.
 *
 * Two writes and no read, exactly as ADR-0012 draws it. `issueFeedbackToken` is a normal
 * signed-in write: anyone signed in may mint the per-Session token whose URL becomes a QR
 * code. `submitParticipantFeedback` takes a `ParticipantToken` — a caller the app produces by
 * resolving that token, never one signed in — and inserts one `participant_feedback` row and
 * nothing else. The resolution that turns the token into the caller is an app-side step
 * (`apps/internal/src/lib/feedback-token.ts`), because the token has to be checked before
 * there is a caller to check it as (see `./caller.ts`).
 *
 * **No elaboration rule here.** A Participant owes nothing and refusing their 3 for want of a
 * sentence would simply lose the 3 — the CHECK that forces prose is on `class_record` and
 * `session_record` only. There is no rate limiting either, deliberately: the accepted cost is
 * that junk Ratings reach the Feedback list (#33, ADR-0012) — the `/feedback` Peserta tab that
 * replaced the retired `/concerns` page (#169).
 */

export type IssueFeedbackTokenResult =
  | { outcome: "issued"; token: string }
  /** A cancelled Session gets no feedback — there was nothing to sit in the room for. */
  | { outcome: "session-cancelled" };

/**
 * The Session's feedback link: the one it has, or a new one when it has none.
 *
 * **Anyone signed in may do this**, so there is no `requireStaff`; the QR is held up at the end
 * of the Session by whoever is standing there. The only bar is a cancelled Session. A cancelled
 * Session is the terminal state that stops it; `arranged` and `delivered` both may issue,
 * because the token is shown at the end of a Session that happened, which is exactly when it is
 * marked delivered.
 *
 * **It never replaces a link** (ADR-0049). Staff print the QR the day before and shorten the link
 * by hand, so a second press — from a colleague, another device, or after a reload — must show the
 * same QR rather than kill the printed one. Nothing here updates or deletes a row: it reads the
 * Session's existing link and inserts only when there is none. When a Session holds several (only
 * `db:reattach-links` adds a second), the original is returned — the earliest `issued_at`, then
 * `token` — and a reattached link, stamped when it was reattached, never becomes the one shown.
 *
 * The status read, the lookup and the insert share a transaction, with the Session row locked, so
 * a Session cancelled at the same instant cannot slip a token out, and two presses at the same
 * moment queue on the lock: the second reads the link the first inserted.
 */
export async function issueFeedbackToken(
  caller: Person,
  sessionId: string,
): Promise<IssueFeedbackTokenResult> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: session.status })
      .from(session)
      .where(eq(session.id, sessionId))
      .for("update");
    // A missing row throws rather than refusing: Detail Sesi 404s on an unknown id before
    // offering the button, and nothing deletes a Session, so this is a bug or a hand-edited
    // request and not a user state.
    if (!current) {
      throw new Error(
        `No Session has id ${sessionId}. Detail Sesi 404s on an unknown id before offering ` +
          "the button, and nothing deletes a Session, so this is a bug or a hand-edited request.",
      );
    }
    if (current.status === "cancelled") return { outcome: "session-cancelled" };

    const [existing] = await tx
      .select({ token: sessionFeedbackToken.token })
      .from(sessionFeedbackToken)
      .where(eq(sessionFeedbackToken.sessionId, sessionId))
      .orderBy(asc(sessionFeedbackToken.issuedAt), asc(sessionFeedbackToken.token))
      .limit(1);
    if (existing) return { outcome: "issued", token: existing.token };

    // The token is minted in the database, the way every id in this schema is — `@sugt/db`
    // generates none in TypeScript, and a UUID is URL-safe and unique by the column's own
    // constraint. `gen_random_uuid()` is what `defaultRandom()` compiles to for the id columns.
    const [row] = await tx
      .insert(sessionFeedbackToken)
      .values({ sessionId, token: sql`gen_random_uuid()::text`, issuedByPersonId: caller.id })
      .returning({ token: sessionFeedbackToken.token });

    return { outcome: "issued", token: row!.token };
  });
}

/**
 * The Ratings a Participant gives, one per Aspect their Class is asked
 * (`PARTICIPANT_FEEDBACK_ASPECTS_BY_CLASS`) and `null` for any other — Hands-on RBL is the Student
 * Class's alone (#446). No elaboration rule, so each asked Rating is simply present.
 */
export type ParticipantFeedbackRatings = Record<ParticipantFeedbackAspect, number | null>;

/**
 * One optional comment per Aspect, keyed off `PARTICIPANT_FEEDBACK_ASPECTS` so the form, this
 * type and the Feedback read (`feedback.ts`) stay driven by the one list. Each is independently
 * optional — a Participant may explain one low Rating and leave the rest blank.
 */
export type ParticipantFeedbackComments = Record<ParticipantFeedbackAspect, string | null>;

/**
 * The two written questions after the Ratings (#446) — not Aspects: no Rating, never counted.
 * Both optional.
 */
export type ParticipantFeedbackAnswers = {
  /** "Melalui kegiatan kelas ini apakah meningkatkan atau menambah pengetahuan Anda?" */
  knowledgeGain: string | null;
  /** "Saran dan masukan untuk kegiatan kelas". */
  suggestions: string | null;
};

/** What the public form collects. The `sessionId` is not here — it comes from the resolved token. */
export type NewParticipantFeedback = {
  classKind: ClassKind;
  name: string;
  ratings: ParticipantFeedbackRatings;
  comments: ParticipantFeedbackComments;
  answers: ParticipantFeedbackAnswers;
};

export type SubmitParticipantFeedbackResult =
  | { outcome: "submitted" }
  /** The Participant typed no name. `name` is `not null`, and a blank one is not a name. */
  | { outcome: "name-required" }
  /**
   * The Ratings are not the Class's Aspects: one it is asked is missing — a Siswa with no Hands-on
   * RBL Rating, say — or one it is not asked is present. The form never sends either; a forced
   * request gets this, and nothing is written.
   */
  | { outcome: "ratings-mismatch" };

/**
 * Insert one Participant's feedback.
 *
 * **The caller is a `ParticipantToken`, never a `Person`** — the sole write in the system
 * keyed on a token rather than an account. The `sessionId` it carries was resolved, and its
 * Session not cancelled, when the token was checked; this trusts that, exactly as a
 * `Person`-taking write trusts `requireStaff` ran. It writes `participant_feedback` and nothing else, which is the
 * whole of what the token authorises.
 */
export async function submitParticipantFeedback(
  caller: ParticipantToken,
  input: NewParticipantFeedback,
): Promise<SubmitParticipantFeedbackResult> {
  const name = input.name.trim();
  if (name === "") return { outcome: "name-required" };

  // Each Aspect the Class is asked must be Rated, and no other. "Required for Siswa" lives here
  // rather than in a CHECK, because Student feedback filed before Hands-on RBL existed has none.
  // The `?? []` is for a forged `classKind` from the unauthenticated form, which the types cannot
  // rule out: it asks nothing, so it is refused here rather than failing the CHECK.
  const asked = PARTICIPANT_FEEDBACK_ASPECTS_BY_CLASS[input.classKind] ?? [];
  const matches = PARTICIPANT_FEEDBACK_ASPECTS.every(
    (aspect) => (input.ratings[aspect] != null) === asked.includes(aspect),
  );
  if (asked.length === 0 || !matches) return { outcome: "ratings-mismatch" };

  // Trim each comment blank → null exactly as the single `comment` was — a Participant owes no
  // prose, so an empty box stores nothing rather than an empty string.
  const trimmed = (comment: string | null): string | null => {
    const value = comment?.trim() ?? "";
    return value === "" ? null : value;
  };
  // A form loaded before #446 shipped sends no `answers` and no `hands_on_rbl`; a GTK or MS
  // submission from one still lands, with neither, rather than throwing on the missing field.
  const answers = input.answers ?? { knowledgeGain: null, suggestions: null };
  // A comment on an Aspect the Class is not asked is dropped, as the form drops it (#446).
  const comment = (aspect: ParticipantFeedbackAspect) =>
    asked.includes(aspect) ? trimmed(input.comments[aspect]) : null;
  await db.insert(participantFeedback).values({
    sessionId: caller.sessionId,
    classKind: input.classKind,
    name,
    handsOnRbl: input.ratings.hands_on_rbl ?? null,
    materials: input.ratings.materials!,
    instructor: input.ratings.instructor!,
    relevance: input.ratings.relevance!,
    handsOnRblComment: comment("hands_on_rbl"),
    materialsComment: comment("materials"),
    instructorComment: comment("instructor"),
    relevanceComment: comment("relevance"),
    knowledgeGain: trimmed(answers.knowledgeGain),
    suggestions: trimmed(answers.suggestions),
  });

  return { outcome: "submitted" };
}
