import type { Stream } from "@sugt/domain";
import { asc, eq } from "drizzle-orm";

import { db } from "../client";
import { ONLINE_SESSION_STILL_STANDS, session, sessionTeacher } from "../schema/delivery";
import { school } from "../schema/reference";
import type { Person } from "./caller";
import { activeRosters, type RosterPerson, type SelectedSchool } from "./rosters";
import { requireStaff } from "./staff-only";

/**
 * **Jadwalkan Sesi daring** — arranging **one** online Session, for **one** School
 * ([#70](https://github.com/mafiefa02/sugt/issues/70)). Each online Session is held at a
 * moment of its own — its own date, its own start time, its own PIC — so there is nothing for
 * a batch to share, and a screen that can write seventeen rows at once fails seventeen rows at
 * once. This replaced the batch outright.
 *
 * Six of every ten Sessions are online and have no Perjadin, so this is the entry point for
 * most of the teaching in the Programme.
 *
 * Staff-only, by the surface list rather than by ADR-0004 (see `./staff-only.ts`, which carries
 * both reasons). It matters more on a write than on a read: a Next.js layout does not run before
 * a Server Action, so `requireStaff` here is the only thing standing between a Teaching Team
 * member and an arranged Session.
 */

/** Who taught one Stream at one Session. At most one per Stream, by primary key. */
export type OnlineSessionTeacher = {
  stream: Stream;
  /** Teaching Team. A composite foreign key into `person (id, role)` refuses anyone else. */
  personId: string;
};

/**
 * What arranging one online Session takes: a School, its own date and start time, a Staff PIC,
 * and optionally a Teaching Team member per Stream.
 *
 * **`mode`, `perjadinId`, `status` and `cancelledReason` are absent by design** — there is no
 * field to set wrong. The write binds `mode = 'online'` with no Perjadin and a Staff PIC, so
 * `session_offline_iff_perjadin`, `session_online_iff_pic` and `session_cancelled_iff_reason`
 * are satisfied before a value is bound.
 */
export type ArrangeOnlineSessionInput = {
  schoolId: string;
  /** `YYYY-MM-DD`. */
  heldOn: string;
  /** Local wall-clock start time (`HH:MM`), in the School's Time Zone. `starts_at` is NOT NULL. */
  startsAt: string;
  /**
   * The Staff member accountable for this Session. Every online Session has its own, since it
   * has no Perjadin to take one from — otherwise six of every ten Sessions would have nobody to
   * file the Session Record.
   */
  picPersonId: string;
  /**
   * **Optional here, and mandatory at Tandai terlaksana.** Naming both Streams at arrangement
   * would block a Session whenever one professor is not yet fixed, which is ordinary; the dialog
   * that marks a Session delivered is where "both Streams were taught" is enforced (#17). An
   * empty list is therefore ordinary rather than a missing value.
   */
  teachers: OnlineSessionTeacher[];
};

/**
 * Why an online Session was not arranged.
 *
 * A collision is a **user state**, not a bug, so it comes back as a value rather than a throw
 * ([#12](https://github.com/mafiefa02/sugt/issues/12)): two Staff arranging the same School's
 * month is exactly that. `NotStaffError` is the opposite case and still throws.
 */
export type ArrangeOnlineSessionResult =
  | { outcome: "arranged"; sessionId: string }
  /** This School already has an online Session on this date that was not cancelled. */
  | { outcome: "collided"; heldOn: string };

/**
 * Arrange one online Session, and its optional `session_teacher` rows, in one transaction.
 *
 * **The transaction is here rather than in the Server Action** (convention 5): a Session and its
 * teacher rows are one act, and a Server Action that opened the boundary would put it somewhere
 * a second caller cannot reuse.
 *
 * `on conflict do nothing` names `session_one_online_per_school_per_day` as its arbiter and
 * repeats its predicate verbatim from `ONLINE_SESSION_STILL_STANDS` — Postgres refuses to infer
 * an index whose predicate does not match, which is a runtime failure. With no target it would
 * also swallow a violation of `session_one_per_school_per_perjadin` or the primary key, and
 * neither of those is a user state. **The index keys on `(school_id, held_on)` and not
 * `starts_at`**: two online Sessions at one School on one day is a mistake whatever the hour, so
 * a returned collision means the day is taken, not the slot.
 */
export async function arrangeOnlineSession(
  caller: Person,
  input: ArrangeOnlineSessionInput,
): Promise<ArrangeOnlineSessionResult> {
  requireStaff(caller);

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(session)
      .values({
        schoolId: input.schoolId,
        mode: "online",
        heldOn: input.heldOn,
        startsAt: input.startsAt,
        onlinePicPersonId: input.picPersonId,
        onlinePicRole: "Staff",
      })
      .onConflictDoNothing({
        target: [session.schoolId, session.heldOn],
        where: ONLINE_SESSION_STILL_STANDS,
      })
      .returning({ id: session.id });

    if (!created) return { outcome: "collided", heldOn: input.heldOn };

    if (input.teachers.length > 0) {
      await tx.insert(sessionTeacher).values(
        input.teachers.map((teacher) => ({
          sessionId: created.id,
          stream: teacher.stream,
          personId: teacher.personId,
        })),
      );
    }

    return { outcome: "arranged", sessionId: created.id };
  });
}

/** A School the screen can arrange a Session at, as a picker or a heading names it. */
export type SchoolOption = SelectedSchool;

/** The three columns a `SchoolOption` renders, selected the same way by both reads below. */
const SCHOOL_OPTION_COLUMNS = {
  id: school.id,
  name: school.name,
  kabupatenKota: school.kabupatenKota,
};

/** Somebody a picker on this screen can name — the PIC, or a Teaching Team member per Stream. */
export type ArrangePerson = RosterPerson;

/** What the standalone screen renders before anything is written: every School, and the pickers. */
export type ArrangeOnlineSessionForm = {
  /** Every School, in name order, for the picker the standalone screen leads with. */
  schools: SchoolOption[];
  /** Staff, for the PIC. */
  staff: ArrangePerson[];
  /** Teaching Team, for the two per-Stream pickers. */
  teachingTeam: ArrangePerson[];
};

/** Every School, in name order, for the standalone screen's School picker. */
async function pickableSchools(): Promise<SchoolOption[]> {
  return db.select(SCHOOL_OPTION_COLUMNS).from(school).orderBy(asc(school.name));
}

/**
 * The standalone screen's payload: the Schools to pick from, and the two rosters. Staff-only, so
 * a Teaching Team member reaching the URL directly is refused server-side rather than shown a
 * form. `Promise.all` keeps the two reads concurrent.
 */
export async function arrangeOnlineSessionForm(caller: Person): Promise<ArrangeOnlineSessionForm> {
  requireStaff(caller);

  const [schools, rosters] = await Promise.all([pickableSchools(), activeRosters()]);

  return { schools, ...rosters };
}

/** What the Detail Sekolah entry point renders: the one School it is on, and the pickers. */
export type ArrangeOnlineSessionAt = {
  school: SchoolOption;
  staff: ArrangePerson[];
  teachingTeam: ArrangePerson[];
};

/**
 * The second entry point, on Detail Sekolah — where you already are when thinking about one
 * School. Keyed on the School's `slug`, the way that page is. Staff-only, so Detail Sekolah calls
 * it only for a Staff caller and renders the affordance only when it returns; `null` when the
 * slug names no School, which its caller has already ruled out but which this read does not
 * assume.
 */
export async function arrangeOnlineSessionAt(
  caller: Person,
  slug: string,
): Promise<ArrangeOnlineSessionAt | null> {
  requireStaff(caller);

  const [row] = await db.select(SCHOOL_OPTION_COLUMNS).from(school).where(eq(school.slug, slug));
  if (!row) return null;

  const rosters = await activeRosters();
  return { school: row, ...rosters };
}
