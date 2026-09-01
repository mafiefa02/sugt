"use server";

import { requirePerson } from "-/lib/person";
import {
  participantFeedbackPage,
  type FeedbackCursor,
  type FeedbackFilters,
  type ParticipantFeedbackRow,
} from "@sugt/db/queries";

/**
 * **The Feedback list's one read, driven from the client.** Both the filter change and the
 * "load more" button call it: a filter change sends the chosen filters with a `null` cursor and
 * gets the first page back to REPLACE the list; "load more" sends the same filters with the
 * current cursor and gets the next page to APPEND. One action serves both because they are the
 * same query — the cursor is the only thing that differs.
 *
 * `requirePerson()` here is the check that counts. A Next.js layout does not run before a Server
 * Action (see `./caller.ts`), so resolving the Person at the top of the action is what closes the
 * path a layout-only check would leave open. No role gate and no `staffSurface`: feedback carries
 * no money, so ADR-0004 opens it to anyone signed in — the same stance as the page and the query.
 *
 * No `revalidatePath`: this returns data to the caller and writes nothing, so there is no cache
 * entry to bust.
 */
export async function loadParticipantFeedback(
  filters: FeedbackFilters,
  cursor: FeedbackCursor | null,
): Promise<{ rows: ParticipantFeedbackRow[]; nextCursor: FeedbackCursor | null }> {
  const person = await requirePerson();
  return participantFeedbackPage(person, { filters, cursor });
}
