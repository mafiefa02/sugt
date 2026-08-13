"use server";

import { resolveFeedbackToken } from "-/lib/feedback-token";
import { submitParticipantFeedback, type NewParticipantFeedback } from "@sugt/db/queries";

/**
 * **Submit one Participant's feedback.** The only Server Action in either app reached without a
 * signed-in Person.
 *
 * **It takes the opaque token and re-resolves it here.** The token is the credential; the
 * `sessionId` is a *result* of validating it and is never an argument — a `sessionId` parameter
 * would be an unauthenticated INSERT into any Session anyone cared to name. The page resolved
 * the token to render the form, but that proves nothing about this call: a form held open past
 * expiry, or past a reissue, must fail here, so the resolution runs again inside the action.
 *
 * `gone` collapses expired, replaced, unknown and cancelled into one outcome — the form shows
 * the same dead-link message a fresh load would, because a scanner can do nothing differently.
 */
export type SubmitFeedbackActionResult =
  | { outcome: "submitted" }
  | { outcome: "name-required" }
  | { outcome: "gone" };

export async function submitFeedbackAction(
  token: string,
  input: NewParticipantFeedback,
): Promise<SubmitFeedbackActionResult> {
  const resolved = await resolveFeedbackToken(token);
  if (resolved.outcome === "gone") return { outcome: "gone" };

  return submitParticipantFeedback(resolved.caller, input);
}
