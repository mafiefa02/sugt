"use server";

import { requirePerson } from "-/lib/person";
import { staffSurface } from "-/lib/staff-surface";
import {
  arrangeOnlineSessions,
  type ArrangeOnlineSessionsResult,
  type OnlineSessionRow,
} from "@sugt/db/queries";

/**
 * **Jadwalkan Sesi daring's write**, and the first Server Action in this app.
 *
 * It resolves the Person, hands the rows to `@sugt/db`, and returns what came back. It
 * is deliberately three lines long:
 *
 * - **It opens no transaction.** The boundary is convention 5's, and it lives in
 *   `arrangeOnlineSessions` — a Server Action that opened one would have put it
 *   somewhere a second caller cannot reuse. There is nothing to co-ordinate here.
 * - **It re-checks nothing the query checks.** `arrangeOnlineSessions` opens with
 *   `requireStaff`, which is what actually closes this path: the signed-in layout does
 *   not run before a Server Action, so a check written here and not there would protect
 *   nothing.
 * - **It does not turn a collision into an error.** A collision is a user state and
 *   comes back as a value, which the form renders beside the rows that caused it.
 *
 * `staffSurface` is here for the same reason it is on the page: a Teaching Team caller
 * reaching this is a bug or an attack rather than a user state, and it should read as a
 * **403** rather than as a crash. This is the first production caller of it — the money
 * screens were expected to be first, and they are not built yet.
 *
 * Nothing is revalidated. Every page in this app reads the session cookie and is
 * therefore rendered per request, so the Sessions arranged here are on Detail Sekolah
 * the next time it is opened without a cache call.
 */
export async function arrangeOnlineSessionsAction(
  rows: OnlineSessionRow[],
): Promise<ArrangeOnlineSessionsResult> {
  const person = await requirePerson();

  return staffSurface(() => arrangeOnlineSessions(person, rows));
}
