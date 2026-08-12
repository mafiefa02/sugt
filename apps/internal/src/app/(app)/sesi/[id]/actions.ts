"use server";

import { requirePerson } from "-/lib/person";
import { staffSurface } from "-/lib/staff-surface";
import {
  cancelSession,
  correctSessionTeachers,
  markSessionDelivered,
  moveSessionDate,
  type CancelSessionResult,
  type CorrectTeachersResult,
  type MarkDeliveredResult,
  type MoveSessionDateResult,
  type TaughtBy,
} from "@sugt/db/queries";
import { revalidatePath } from "next/cache";

/**
 * **Detail Sesi's four writes.** Each is the same three lines as Jadwalkan Sesi daring's:
 * resolve the Person, hand it to `@sugt/db`, return what came back.
 *
 * None of them opens a transaction. The boundary is convention 5's and it lives in the
 * query function — Tandai terlaksana writes `session.status` and `session_teacher`
 * together, and an Action that opened the boundary would have put it somewhere a second
 * caller cannot reuse.
 *
 * None of them re-checks Staff. `requireStaff` inside each query function is what
 * actually closes this path: a Next.js layout does not run before a Server Action, so a
 * check written here and not there would protect nothing. `staffSurface` is here for the
 * reason it is on the page — a Teaching Team caller reaching one of these is a bug or an
 * attack rather than a user state, and it should read as a **403** rather than as a crash.
 *
 * **A refusal is a value and is returned, not thrown.** `not-arranged`, `stream-unnamed`,
 * `reason-required`, `collided` and `outside-perjadin` are all states a correct screen can
 * reach — a second Staff member cancelled the Session while this page was open, a form was
 * submitted with one Stream empty — and by the rule settled on the query layer each gets a
 * field-level message rather than an error page.
 *
 * **`revalidatePath` is here where Jadwalkan Sesi daring needed none, and the two are not
 * in conflict.** That module's note is about the server: every page in this app reads the
 * session cookie, so every page is rendered per request and there is no server-side cache
 * entry for a write to invalidate. What these four have to clear is the **client** router
 * cache — these write the Session the user is looking at, so its RSC payload is already in
 * the browser and would otherwise be re-shown unchanged. Jadwalkan Sesi daring sent the
 * browser to a different route and had no such payload to drop.
 *
 * It is called only on the outcome that wrote something. A refused write left the page
 * correct, and busting a cache to re-render the same thing is a round trip for nothing.
 */

/** **Tandai terlaksana** — the status and who taught, as one act. */
export async function markSessionDeliveredAction(
  sessionId: string,
  teachers: TaughtBy[],
): Promise<MarkDeliveredResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => markSessionDelivered(person, sessionId, teachers));
  if (result.outcome === "delivered") revalidatePath(`/sesi/${sessionId}`);
  return result;
}

/** Correcting a mis-named professor, which stays possible after delivery. */
export async function correctSessionTeachersAction(
  sessionId: string,
  teachers: TaughtBy[],
): Promise<CorrectTeachersResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => correctSessionTeachers(person, sessionId, teachers));
  if (result.outcome === "corrected") revalidatePath(`/sesi/${sessionId}`);
  return result;
}

/** **Batalkan Sesi** — the reason travels in the same call, because the CHECK refuses it apart. */
export async function cancelSessionAction(
  sessionId: string,
  reason: string,
): Promise<CancelSessionResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => cancelSession(person, sessionId, reason));
  if (result.outcome === "cancelled") revalidatePath(`/sesi/${sessionId}`);
  return result;
}

/** A slipped date, which is an edit and not a cancellation. */
export async function moveSessionDateAction(
  sessionId: string,
  heldOn: string,
): Promise<MoveSessionDateResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => moveSessionDate(person, sessionId, heldOn));
  if (result.outcome === "moved") revalidatePath(`/sesi/${sessionId}`);
  return result;
}
