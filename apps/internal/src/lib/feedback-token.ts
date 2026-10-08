import { db, schema } from "@sugt/db";
import type { ParticipantToken } from "@sugt/db/queries";
import { eq } from "drizzle-orm";

/**
 * Turning a feedback token into the caller a Participant write is checked against.
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
 * **`gone` is one outcome and carries no reason**, deliberately. An unknown token and one for a
 * cancelled Session are the same to a scanner: nothing they can do differently. A link no longer
 * expires and is never replaced (ADR-0049), so those two are the only ways here.
 */
export type ResolvedFeedbackToken =
  | { outcome: "open"; caller: ParticipantToken }
  | { outcome: "gone" };

/**
 * Resolve the token in a `/f/{token}` URL.
 *
 * A lookup by token, and nothing about when it was issued: a link printed weeks ago opens as well
 * as one issued a minute ago (ADR-0049). A Session may hold several links (`db:reattach-links`),
 * and each resolves to that Session. A cancelled Session's token is refused, for the same
 * money-free reason a cancelled Session takes no feedback.
 */
export async function resolveFeedbackToken(token: string): Promise<ResolvedFeedbackToken> {
  const [row] = await db
    .select({
      sessionId: schema.sessionFeedbackToken.sessionId,
      status: schema.session.status,
    })
    .from(schema.sessionFeedbackToken)
    .innerJoin(schema.session, eq(schema.session.id, schema.sessionFeedbackToken.sessionId))
    .where(eq(schema.sessionFeedbackToken.token, token))
    .limit(1);

  if (!row) return { outcome: "gone" };
  if (row.status === "cancelled") return { outcome: "gone" };

  return { outcome: "open", caller: { kind: "participant", sessionId: row.sessionId } };
}
