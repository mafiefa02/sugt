"use server";

import { requireEnv } from "-/lib/env";
import { requirePerson } from "-/lib/person";
import { staffSurface } from "-/lib/staff-surface";
import {
  cancelSession,
  correctSessionTeachers,
  fileClassRecord,
  fileSessionRecord,
  issueFeedbackToken,
  markSessionDelivered,
  moveSessionDate,
  type CancelSessionResult,
  type CorrectTeachersResult,
  type FileClassRecordResult,
  type FileSessionRecordResult,
  type IssueFeedbackTokenResult,
  type MarkDeliveredResult,
  type MoveSessionDateResult,
  type NewClassRecord,
  type NewSessionRecord,
  type TaughtBy,
} from "@sugt/db/queries";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";

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

/** A slipped date, which is an edit and not a cancellation — and its time moves with it (#72). */
export async function moveSessionDateAction(
  sessionId: string,
  heldOn: string,
  startsAt: string,
): Promise<MoveSessionDateResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => moveSessionDate(person, sessionId, heldOn, startsAt));
  if (result.outcome === "moved") revalidatePath(`/sesi/${sessionId}`);
  return result;
}

/**
 * **File a Class Record** — a Teaching Team member's account of one Class they taught.
 *
 * No `staffSurface` here, and that is the difference from the four above: a Class Record is
 * Teaching Team's, not Staff's, and `fileClassRecord` returns `not-teaching-team` as a value
 * rather than throwing. There is no Teaching-Team choke point that throws, so there is
 * nothing for a surface to translate — the caller is still resolved, and the query still
 * holds the rule with its composite foreign key.
 *
 * `revalidatePath` clears the client router cache so the owed list on the page the filer is
 * looking at drops the Record they just filed. Called only on the outcome that wrote one.
 */
export async function fileClassRecordAction(input: NewClassRecord): Promise<FileClassRecordResult> {
  const person = await requirePerson();

  const result = await fileClassRecord(person, input);
  if (result.outcome === "filed") revalidatePath(`/sesi/${input.sessionId}`);
  return result;
}

/**
 * **File a Session Record** — the PIC's account of the visit as a whole.
 *
 * Staff-only, so it goes through `staffSurface`: `fileSessionRecord` throws `NotStaffError`
 * on a Teaching Team caller, which reads as a 403 rather than a crash. Every other refusal
 * comes back as a value for the form to place on a field.
 */
export async function fileSessionRecordAction(
  input: NewSessionRecord,
): Promise<FileSessionRecordResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => fileSessionRecord(person, input));
  if (result.outcome === "filed") revalidatePath(`/sesi/${input.sessionId}`);
  return result;
}

/**
 * What issuing a feedback token hands back to the QR dialog: the link and its QR image. The
 * `session-cancelled` refusal is the write's own, reused rather than restated; only the `issued`
 * arm differs, because the action renders the QR the query never sees.
 */
export type IssueFeedbackTokenActionResult =
  | { outcome: "issued"; url: string; qr: string }
  | Extract<IssueFeedbackTokenResult, { outcome: "session-cancelled" }>;

/**
 * **Issue — or reissue — the Participant Feedback token, and render its QR.**
 *
 * No `staffSurface` and no role check: anyone signed in may hold up the QR at the end of a
 * Session, so `issueFeedbackToken` takes a plain `Person` and refuses only a cancelled Session.
 *
 * **The QR is generated here, server-side, and the colours are baked into the image** — black
 * on white via the `color` option — so a scanner reads it whatever the theme, and the dialog
 * needs no client QR dependency. The URL points at this app's own `/f/{token}`: the handler
 * lives on the internal app, whose base URL is `BETTER_AUTH_URL`.
 *
 * No `revalidatePath`: nothing on the page reflects the token, so there is nothing to refresh.
 */
export async function issueFeedbackTokenAction(
  sessionId: string,
): Promise<IssueFeedbackTokenActionResult> {
  const person = await requirePerson();

  const result = await issueFeedbackToken(person, sessionId);
  if (result.outcome !== "issued") return result;

  const url = `${requireEnv("BETTER_AUTH_URL")}/f/${result.token}`;
  const qr = await QRCode.toDataURL(url, {
    color: { dark: "#000000ff", light: "#ffffffff" },
    margin: 2,
    width: 320,
  });

  return { outcome: "issued", url, qr };
}
