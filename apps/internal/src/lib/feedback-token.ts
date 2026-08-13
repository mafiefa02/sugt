import { db, schema } from "@sugt/db";
import type { ParticipantToken } from "@sugt/db/queries";
import { eq } from "drizzle-orm";

/**
 * Resolving a feedback token into the caller a Participant write is checked as.
 *
 * **Why this lives in the app rather than in `@sugt/db`.** It is the same deliberate exception
 * `invite-list.ts` is: `@sugt/db`'s query layer takes a caller it is given and never resolves
 * one, because resolving is what *produces* the caller its queries are checked against — so it
 * cannot itself be one of them. `caller.ts` says as much about the `ParticipantToken` arm: the
 * token has to be checked before there is a caller to check it as. See ADR-0012.
 */

/**
 * A resolved token, or `gone`.
 *
 * **`gone` is one outcome and carries no reason**, deliberately. An unknown token, an expired
 * one, one replaced by a reissue, and one for a cancelled Session are all the same to a scanner:
 * nothing they can do differently, and the same remedy — ask for a fresh QR. A reason field
 * would be a thing somebody eventually renders, and #33 asks that expired and replaced show the
 * same page and the same message.
 */
export type ResolvedFeedbackToken =
  | { outcome: "open"; caller: ParticipantToken }
  | { outcome: "gone" };

/**
 * Resolve the token in a `/f/{token}` URL.
 *
 * **The expiry is enforced here, in the handler.** `expires_at` is a column and not a gate —
 * nothing in the database refuses an expired token — so this reads it and compares it to now.
 * A cancelled Session's token is refused for the same money-free reason a cancelled Session
 * takes no feedback.
 *
 * A replaced token needs no special case: the row is keyed on `session_id`, so a reissue
 * overwrites the `token` column and the old string matches nothing here.
 */
export async function resolveFeedbackToken(token: string): Promise<ResolvedFeedbackToken> {
  const [row] = await db
    .select({
      sessionId: schema.sessionFeedbackToken.sessionId,
      expiresAt: schema.sessionFeedbackToken.expiresAt,
      status: schema.session.status,
    })
    .from(schema.sessionFeedbackToken)
    .innerJoin(schema.session, eq(schema.session.id, schema.sessionFeedbackToken.sessionId))
    .where(eq(schema.sessionFeedbackToken.token, token))
    .limit(1);

  if (!row) return { outcome: "gone" };
  if (row.status === "cancelled") return { outcome: "gone" };
  if (row.expiresAt.getTime() <= Date.now()) return { outcome: "gone" };

  return { outcome: "open", caller: { kind: "participant", sessionId: row.sessionId } };
}
