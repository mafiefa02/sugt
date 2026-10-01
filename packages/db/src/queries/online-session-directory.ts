import type { SessionStatus } from "@sugt/domain";
import { desc, eq } from "drizzle-orm";

import { db } from "../client";
import { session } from "../schema/delivery";
import { school } from "../schema/reference";
import type { Person } from "./caller";

/**
 * **The online Session list** — every online Session, open to anyone signed in.
 *
 * The online counterpart to `./perjadin-directory.ts`: offline Sessions are reached through the
 * Perjadin they sit on, but an online Session has no Perjadin, so without this there is no screen
 * that lists them together. A separate module from `./session-detail.ts` for the same reason the
 * Perjadin list and detail are separate — convention 3 is one module per surface's payload.
 *
 * No role check: an online Session's School, date, start time, Peserta and status are delivery data,
 * and ADR-0004 opens that to everyone signed in. Arranging one stays Staff-only, on the form.
 */

/**
 * One online Session, as the `/sesi-daring` table shows it (#344): the School, the date, the two WIB
 * wall-clock times and the status. **No zone field and no School slug**: an online Session is always
 * WIB (#283), which the table states once in its "Jam Mulai (WIB)" / "Jam Selesai (WIB)" headers, and
 * the row links to the Session rather than to `/sekolah/…` — convention 3, nothing the screen does
 * not render.
 */
export type DirectoryOnlineSession = {
  id: string;
  schoolName: string;
  heldOn: string;
  startsAt: string;
  /**
   * The WIB wall-clock end time (#283). Nullable because `session.ends_at` is — an offline row carries
   * none — though every online Session recorded since #318 has one; the table shows "—" for a null.
   */
  endsAt: string | null;
  status: SessionStatus;
};

/**
 * Every online Session, newest first — `held_on` then `starts_at`, with `id` breaking the tie so
 * the order is total, the same shape `./perjadin-directory.ts` orders on. Every status is here,
 * including cancelled: this is the calendar of what was scheduled, not a count of what happened.
 *
 * The School join is inner and NOT NULL by construction, so it cannot drop an online row. **No PIC
 * join any more (#284):** an online Session tracks no PIC, so nothing here reads `person`. **The
 * Province join is gone too (#283)**: an online Session's zone is always WIB, not derived from the
 * School's Province, so nothing here reads a zone at all.
 *
 * **`where mode = 'online'` is the explicit exclusion of offline Sessions** — the readable statement
 * of intent, and now the only thing that excludes them (there is no PIC-null side effect to lean on).
 */
export async function onlineSessionDirectory(_caller: Person): Promise<DirectoryOnlineSession[]> {
  return db
    .select({
      id: session.id,
      schoolName: school.name,
      heldOn: session.heldOn,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      status: session.status,
    })
    .from(session)
    .innerJoin(school, eq(school.id, session.schoolId))
    .where(eq(session.mode, "online"))
    .orderBy(desc(session.heldOn), desc(session.startsAt), desc(session.id));
}
