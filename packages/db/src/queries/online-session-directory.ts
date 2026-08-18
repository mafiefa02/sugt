import type { SessionStatus, TimeZone } from "@sugt/domain";
import { desc, eq } from "drizzle-orm";

import { db } from "../client";
import { session } from "../schema/delivery";
import { person } from "../schema/people";
import { province, school } from "../schema/reference";
import type { Person } from "./caller";

/**
 * **The online Session list** — every online Session, open to anyone signed in.
 *
 * The online counterpart to `./perjadin-directory.ts`: offline Sessions are reached through the
 * Perjadin they sit on, but an online Session has no Perjadin, so without this there is no screen
 * that lists them together. A separate module from `./session-detail.ts` for the same reason the
 * Perjadin list and detail are separate — convention 3 is one module per surface's payload.
 *
 * No role check: an online Session's School, date, start time, PIC and status are delivery data,
 * and ADR-0004 opens that to everyone signed in. Arranging one stays Staff-only, on the form.
 */

/** One online Session, as the list shows it. */
export type DirectoryOnlineSession = {
  id: string;
  schoolName: string;
  schoolSlug: string;
  heldOn: string;
  startsAt: string;
  /**
   * The School's Province's Time Zone, for rendering `startsAt` — no Indonesian Province straddles
   * a boundary, so the zone lives on `province`, not `school`, exactly as `./session-detail.ts` reads it.
   */
  timeZone: TimeZone;
  picFullName: string;
  status: SessionStatus;
};

/**
 * Every online Session, newest first — `held_on` then `starts_at`, with `id` breaking the tie so
 * the order is total, the same shape `./perjadin-directory.ts` orders on. Every status is here,
 * including cancelled: this is the calendar of what was scheduled, not a count of what happened.
 *
 * The joins are all inner and all NOT NULL by construction: an online Session has a School (its
 * Province carries the zone) and an `online_pic_person_id` (the `session_online_iff_pic` CHECK ties
 * its presence to `mode = 'online'`), so none of them can drop an online row.
 *
 * **`where mode = 'online'` is the explicit exclusion of offline Sessions**, and it stays even
 * though the inner join on `online_pic_person_id` would drop them anyway — that same CHECK makes an
 * offline Session's PIC null, so the join excludes it too. The filter is the readable statement of
 * intent; leaning on the join alone would make "online only" a fact a reader has to reconstruct
 * from a NULL, and it would silently break if this ever moved to the `coalesce` PIC join
 * `./session-detail.ts` uses. Belt and braces, on purpose.
 */
export async function onlineSessionDirectory(_caller: Person): Promise<DirectoryOnlineSession[]> {
  return db
    .select({
      id: session.id,
      schoolName: school.name,
      schoolSlug: school.slug,
      heldOn: session.heldOn,
      startsAt: session.startsAt,
      timeZone: province.timeZone,
      picFullName: person.fullName,
      status: session.status,
    })
    .from(session)
    .innerJoin(school, eq(school.id, session.schoolId))
    .innerJoin(province, eq(province.code, school.provinceCode))
    .innerJoin(person, eq(person.id, session.onlinePicPersonId))
    .where(eq(session.mode, "online"))
    .orderBy(desc(session.heldOn), desc(session.startsAt), desc(session.id));
}
