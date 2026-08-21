import {
  CLASS_KINDS,
  STREAMS,
  type ClassKind,
  type SessionMode,
  type SessionStatus,
  type Stream,
  type TimeZone,
} from "@sugt/domain";
import { and, asc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "../client";
import { session, sessionTeacher } from "../schema/delivery";
import { person } from "../schema/people";
import { province, school } from "../schema/reference";
import { perjadin } from "../schema/travel";
import type { Person } from "./caller";
import { requireStaff } from "./staff-only";

/**
 * **Detail Sesi** — one Session, what has been filed against it, who still owes what,
 * and the three writes it offers: Tandai terlaksana, Batalkan Sesi and moving the date.
 *
 * The read is open to anyone signed in, because a Session carries no money and ADR-0004
 * opens delivery data to both roles. **Every write here is Staff-only**, by the surface
 * list rather than by ADR-0004 — the same one guard for the second of its two reasons,
 * as `./staff-only.ts` sets out.
 *
 * Settled on [#17](https://github.com/mafiefa02/sugt/issues/17): marking delivered and
 * recording who taught are **one act**, cancelling is offered only while `arranged`, a
 * slipped date is an edit rather than a cancellation, and `delivered` is terminal while
 * who taught is not.
 */

/** One Teaching Team member and the Stream they taught. At most one per Stream, by primary key. */
export type SessionDetailTeacher = {
  stream: Stream;
  personId: string;
  fullName: string;
};

/**
 * One record nobody has filed yet.
 *
 * Two kinds rather than one, because the two are owed by different people for different
 * reasons: a professor owes a Class Record per Class they taught, and the PIC owes one
 * Session Record about the visit. `person` is who to chase — the whole point of the list,
 * since nothing is required and nothing is blocked (ADR-0009), and naming who has not
 * filed is the only enforcement this tool has.
 */
export type OwedRecord =
  | { kind: "class-record"; personId: string; fullName: string; classKind: ClassKind }
  | { kind: "session-record"; personId: string; fullName: string };

/** The Perjadin an offline Session happens on, and the window its date must sit inside. */
export type SessionPerjadin = {
  id: string;
  startsOn: string;
  endsOn: string;
};

/** Everything Detail Sesi renders, in one round trip. */
export type SessionDetail = {
  id: string;
  schoolName: string;
  /** The School's page is where this Session was reached from, and the way back to it. */
  schoolSlug: string;
  mode: SessionMode;
  heldOn: string;
  /** Wall-clock start time local to the School (`HH:MM:SS`), rendered with its zone. */
  startsAt: string;
  /**
   * The School's Province's Time Zone, for rendering `startsAt` — no Indonesian Province
   * straddles a boundary, so the zone lives on `province`, not `school`.
   */
  timeZone: TimeZone;
  status: SessionStatus;
  /** Set on a cancelled Session and null on every other, by CHECK. */
  cancelledReason: string | null;
  /**
   * **A `coalesce`, so a query rather than a column.** An offline Session takes its
   * Perjadin's PIC and carries no PIC columns of its own — the composite foreign key is
   * `MATCH SIMPLE` precisely so it may not — while an online Session has no Perjadin and
   * carries its own.
   */
  picPersonId: string;
  picFullName: string;
  /** Null for an online Session, which by CHECK has no Perjadin. */
  perjadin: SessionPerjadin | null;
  teachers: SessionDetailTeacher[];
  /**
   * Who Tandai terlaksana offers **before** anybody confirms: the Group's Stream
   * assignments on an offline Session, and nobody at all on an online one, which has no
   * Group to read.
   *
   * Read here rather than copied into `session_teacher` at arrangement. A Group is
   * replaced wholesale — one transaction deletes every member row and inserts a new set —
   * so rows copied out of it then would be stranded by a substitution with no constraint
   * to catch it.
   */
  suggestedTeachers: SessionDetailTeacher[];
  /** Every active Teaching Team member, for the two per-Stream pickers in the dialog. */
  teachingTeam: { id: string; fullName: string }[];
  /**
   * **Filed and expected are two numbers and are not reconciled.** `class_record` has no
   * foreign key to `session_teacher` — it references `session (id)` and `person (id, role)`
   * only — so a Record filed by somebody this Session never named is a legal row, and
   * removing a named professor does not delete what they already filed. The database
   * permits the divergence deliberately; the screen shows both rather than pretending
   * they cannot differ.
   */
  classRecordsFiled: number;
  /**
   * Computed from the teachers this Session **names**, never from
   * `CLASS_RECORDS_PER_SESSION`. That constant is six and assumes both Streams are named
   * — true after Tandai terlaksana and not before, so reading it here would show three
   * units of debt attached to nobody.
   */
  classRecordsExpected: number;
  /**
   * **Empty until the Session is delivered.** An arranged online Session already names
   * its professors, so a list that did not filter on `delivered` would report Records
   * owed for teaching that has not happened — the overdue-shaped state ADR-0006 exists
   * to prevent.
   */
  owed: OwedRecord[];
};

/**
 * Whether a date lies inside a Perjadin's window, both ends inclusive — a trip teaches on
 * the day it arrives and on the day it leaves.
 *
 * **Exported from this module and deliberately not from `./index.ts`.** `docs/data-model.md`
 * says the rule belongs *wherever the date is written*, and there are three such places, all
 * three now calling this: the date edit below; `./perjadin-planning.ts`, which checks every
 * Session on a trip before it writes one; and `movePerjadinDates` in `./perjadin-detail.ts`,
 * which checks each arranged Session's shifted date when a trip moves
 * ([#55](https://github.com/mafiefa02/sugt/issues/55)). That third one's cascade is built and
 * tested; its edit surface has no screen yet.
 *
 * They are modules *inside* this package and import it from here directly. Putting it on
 * the package's public surface would break convention 3 — nothing is exported that a
 * surface renders, and no surface renders this.
 *
 * A plain string comparison, which is exact rather than lucky: `date` comes back from
 * Postgres as `YYYY-MM-DD`, and that format sorts lexicographically in calendar order.
 * Parsing to `Date` would introduce a time zone where the domain has none — a Session is a
 * calendar day, not an instant, which is why the column is `date` and not `timestamptz`.
 */
export function heldOnWithinPerjadin(
  heldOn: string,
  window: { startsOn: string; endsOn: string },
): boolean {
  return heldOn >= window.startsOn && heldOn <= window.endsOn;
}

/** Which Streams a set of teacher rows leaves unnamed. Empty when both are covered. */
function streamsUnnamed(teachers: { stream: Stream }[]): Stream[] {
  return STREAMS.filter((stream) => !teachers.some((teacher) => teacher.stream === stream));
}

/**
 * One Session and everything the screen renders, or `null` when the id names none.
 *
 * `null` is a reachable state rather than an error: a link pasted into a message outlives
 * the row it points at, and the screen turns it into a 404.
 *
 * The Session's own statement returns one row per named teacher — at most two — so the
 * Session columns repeat and are read off the first. The LATERALs sit after the
 * `session_teacher` join because a LATERAL may only reference what precedes it, and the
 * per-teacher one references `session_teacher.person_id`.
 */
export async function sessionDetail(_caller: Person, id: string): Promise<SessionDetail | null> {
  const pic = alias(person, "pic");
  const teacher = alias(person, "teacher");

  // Two statements rather than one, and the same reading of convention 3 that Jadwalkan
  // Sesi daring settled: the roster is an unrelated aggregate, and the single-statement
  // form would be a `union all` stapling it on behind a placeholder column. The screen
  // still makes one call and assembles nothing. `Promise.all` keeps the two concurrent.
  const [rows, teachingTeam] = await Promise.all([
    db
      .select({
        schoolName: school.name,
        schoolSlug: school.slug,
        mode: session.mode,
        heldOn: session.heldOn,
        startsAt: session.startsAt,
        timeZone: province.timeZone,
        status: session.status,
        cancelledReason: session.cancelledReason,

        picPersonId: pic.id,
        picFullName: pic.fullName,

        perjadinId: perjadin.id,
        perjadinStartsOn: perjadin.startsOn,
        perjadinEndsOn: perjadin.endsOn,

        teacherStream: sessionTeacher.stream,
        teacherPersonId: teacher.id,
        teacherFullName: teacher.fullName,
        /** Which Classes this teacher has filed a Record for. Empty array when none. */
        teacherFiledKinds: sql<ClassKind[]>`filed.kinds`,

        classRecordsFiled: sql<number>`totals.class_records_filed`.mapWith(Number),
        sessionRecordFiled: sql<boolean>`totals.session_record_filed`,
        /** The Group's Stream assignments, which is what Tandai terlaksana pre-fills from. */
        groupTeachers: sql<SessionDetailTeacher[]>`grouped.members`,
      })
      .from(session)
      .innerJoin(school, eq(school.id, session.schoolId))
      // The School's Province carries the Time Zone `startsAt` is read in. NOT NULL both ways,
      // so an inner join.
      .innerJoin(province, eq(province.code, school.provinceCode))
      // Outer: six of every ten Sessions have no Perjadin.
      .leftJoin(perjadin, eq(perjadin.id, session.perjadinId))
      // The `coalesce` the criterion names, resolved in the join rather than in TypeScript.
      // Every Session has exactly one of the two, by the pair of mirror CHECKs, so this is
      // an inner join on a value that is never null.
      .innerJoin(
        pic,
        eq(pic.id, sql`coalesce(${session.onlinePicPersonId}, ${perjadin.picPersonId})`),
      )
      // Outer, and unfiltered: naming a professor is optional at arrangement, so an
      // arranged Session with no teacher rows is ordinary rather than incomplete.
      .leftJoin(sessionTeacher, eq(sessionTeacher.sessionId, session.id))
      .leftJoin(teacher, eq(teacher.id, sessionTeacher.personId))
      .leftJoinLateral(
        sql`(
        select coalesce(array_agg(cr.class_kind), '{}') as kinds
        from class_record cr
        where cr.session_id = ${session.id}
          and cr.filed_by_person_id = ${sessionTeacher.personId}
      ) as filed`,
        sql`true`,
      )
      .leftJoinLateral(
        sql`(
        select
          (select count(*) from class_record cr where cr.session_id = ${session.id})
            as class_records_filed,
          exists (
            select 1 from session_record sr
            where sr.session_id = ${session.id}
              and sr.filed_by_person_id = coalesce(${session.onlinePicPersonId}, ${perjadin.picPersonId})
          ) as session_record_filed
      ) as totals`,
        sql`true`,
      )
      // The Group's Stream assignments, for an offline Session only — `perjadin_id` is null
      // on every online one, so this comes back empty for them without a special case.
      //
      // **Read here rather than copied at arrangement.** Rencanakan Perjadin writes no
      // `session_teacher` rows: a Group is replaced wholesale, so rows copied out of it then
      // would be stranded by a substitution, silently, with no constraint to catch it.
      .leftJoinLateral(
        sql`(
        select coalesce(
          json_agg(json_build_object(
            'stream', gm.stream, 'personId', gm.person_id, 'fullName', p.full_name
          ) order by gm.stream),
          '[]'
        ) as members
        from group_member gm
        join person p on p.id = gm.person_id
        where gm.perjadin_id = ${session.perjadinId} and gm.stream is not null
      ) as grouped`,
        sql`true`,
      )
      .where(eq(session.id, id))
      .orderBy(sessionTeacher.stream),
    // Revoked People are not offered, for the reason Jadwalkan Sesi daring gives: naming
    // one commits them to teaching that has not happened, and a picker is about what
    // happens next. Historical references to them stay intact.
    db
      .select({ id: person.id, fullName: person.fullName })
      .from(person)
      .where(and(eq(person.active, true), eq(person.role, "Teaching Team")))
      .orderBy(asc(person.fullName)),
  ]);

  const [first] = rows;
  if (!first) return null;

  const teachers: SessionDetailTeacher[] = [];
  const owedClassRecords: OwedRecord[] = [];
  for (const row of rows) {
    // The outer join is all-or-nothing: a Session naming nobody comes back as one row
    // with every teacher column null.
    if (row.teacherStream === null || row.teacherPersonId === null || row.teacherFullName === null)
      continue;

    teachers.push({
      stream: row.teacherStream,
      personId: row.teacherPersonId,
      fullName: row.teacherFullName,
    });

    for (const classKind of CLASS_KINDS) {
      if (row.teacherFiledKinds.includes(classKind)) continue;
      owedClassRecords.push({
        kind: "class-record",
        personId: row.teacherPersonId,
        fullName: row.teacherFullName,
        classKind,
      });
    }
  }

  const owed: OwedRecord[] =
    first.status === "delivered"
      ? [
          ...owedClassRecords,
          ...(first.sessionRecordFiled
            ? []
            : [
                {
                  kind: "session-record" as const,
                  personId: first.picPersonId,
                  fullName: first.picFullName,
                },
              ]),
        ]
      : [];

  return {
    id,
    schoolName: first.schoolName,
    schoolSlug: first.schoolSlug,
    mode: first.mode,
    heldOn: first.heldOn,
    startsAt: first.startsAt,
    timeZone: first.timeZone,
    status: first.status,
    cancelledReason: first.cancelledReason,
    picPersonId: first.picPersonId,
    picFullName: first.picFullName,
    perjadin:
      first.perjadinId === null || first.perjadinStartsOn === null || first.perjadinEndsOn === null
        ? null
        : {
            id: first.perjadinId,
            startsOn: first.perjadinStartsOn,
            endsOn: first.perjadinEndsOn,
          },
    teachers,
    suggestedTeachers: first.groupTeachers,
    teachingTeam,
    classRecordsFiled: first.classRecordsFiled,
    classRecordsExpected: teachers.length * CLASS_KINDS.length,
    owed,
  };
}

/**
 * Why a write against a Session did not happen.
 *
 * Every one of these is a **user state and comes back as a value**, never as a throw —
 * the rule settled on [#12](https://github.com/mafiefa02/sugt/issues/12) is that a state
 * reachable from correct UI gets a friendly field-level message rather than an error page.
 * Two Staff on the same Session, one of them holding a page opened before the other
 * cancelled it, is exactly that. `NotStaffError` is the opposite case and still throws.
 */
/**
 * A Session past the point a write is offered.
 *
 * `arranged` is excluded rather than merely absent: every refusal below is *because* the
 * Session left that state, so a `status` of `arranged` would be a refusal with no reason.
 * The screens read this to choose a sentence, and the narrower type is what keeps them
 * from having to write one for a case that cannot arrive.
 */
export type PastArranged = Exclude<SessionStatus, "arranged">;

export type MarkDeliveredResult =
  | { outcome: "delivered" }
  | { outcome: "not-arranged"; status: PastArranged }
  /** A Stream nobody was named for, which Tandai terlaksana will not submit with. */
  | { outcome: "stream-unnamed"; missing: Stream[] };

export type CorrectTeachersResult =
  | { outcome: "corrected" }
  | { outcome: "stream-unnamed"; missing: Stream[] }
  /** The Session was cancelled, so there is no teaching to correct the record of. */
  | { outcome: "not-correctable"; status: "cancelled" }
  /**
   * An offline Session, whose teachers are trip-scoped `session_teaching_team` names edited on the
   * Perjadin, not `session_teacher` People (ADR-0020, #140). The detail-page surface never offers
   * this for offline; the guard is a backstop against a hand-edited request, so no `session_teacher`
   * row is ever written for an offline Session.
   */
  | { outcome: "offline-not-correctable" };

export type CancelSessionResult =
  | { outcome: "cancelled" }
  | { outcome: "reason-required" }
  | { outcome: "not-arranged"; status: PastArranged };

export type MoveSessionDateResult =
  | { outcome: "moved" }
  | { outcome: "not-arranged"; status: PastArranged }
  /** The School already has an online Session that still stands on the new date. */
  | { outcome: "collided"; constraint: "session_one_online_per_school_per_day" }
  /** An arranged offline Session may not leave the trip it happens on. */
  | { outcome: "outside-perjadin"; startsOn: string; endsOn: string };

/** Who taught one Stream. The form names at most one per Stream, as the primary key does. */
export type TaughtBy = { stream: Stream; personId: string };

/**
 * Replace a Session's teacher rows with the set given.
 *
 * **Replaced rather than merged**, because the dialog shows the complete answer: a Stream
 * it comes back without is a Stream Staff removed, and merging would make removal
 * impossible.
 */
async function replaceTeachers(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  sessionId: string,
  teachers: TaughtBy[],
) {
  await tx.delete(sessionTeacher).where(eq(sessionTeacher.sessionId, sessionId));
  if (teachers.length === 0) return;

  await tx.insert(sessionTeacher).values(
    teachers.map((taught) => ({
      sessionId,
      stream: taught.stream,
      personId: taught.personId,
    })),
  );
}

/**
 * The Session's status, locked for the rest of the transaction.
 *
 * `for update` is what makes every status check below mean something. Without it two Staff
 * pressing a button at once both read `arranged`, and the second overwrites the first.
 *
 * **A missing row throws rather than coming back as a refusal**, and that is the same rule
 * `requirePerson` states in the app: a state that can only be reached from a bug must not
 * get a friendly path, or somebody eventually builds a form that relies on it. Nothing in
 * this system deletes a `session` row, and the screen 404s on an unknown id before it
 * offers a single one of these writes — so an id that names nothing here arrived by a
 * hand-edited request, which is not a user state to be helpful about.
 */
async function lockedSession(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  sessionId: string,
): Promise<{ status: SessionStatus; mode: SessionMode }> {
  const [row] = await tx
    .select({ status: session.status, mode: session.mode })
    .from(session)
    .where(eq(session.id, sessionId))
    .for("update");

  if (!row) {
    throw new Error(
      `No Session has id ${sessionId}. Detail Sesi 404s on an unknown id before offering ` +
        "any write, and nothing deletes a Session, so this is a bug or a hand-edited request.",
    );
  }
  return row;
}

/**
 * **Tandai terlaksana** — mark a Session delivered. What it writes turns on the mode.
 *
 * **Online** — one act writing `session.status` and `session_teacher`, deliberately not two
 * steps. "Who still owes what" is computed from who taught, so a Session marked delivered with
 * nobody recorded owes nothing and the chase list is silently empty — the worst failure
 * available to a tool whose only enforcement is naming who has not filed. So an online Session
 * names a Person per Stream and the both-Streams rule is enforced here.
 *
 * **Offline** — **status only** (ADR-0019, ADR-0020, #140). An offline Session already carries
 * its Stream (`session.stream`) and its teachers are trip-scoped names recorded through
 * `session_teaching_team`, edited on the Perjadin — not People, so `session_teacher` cannot and
 * must not hold them. There is no who-taught prompt and no teacher row is written; `teachers` is
 * ignored. Offline Class Records and the offline progress metric are deferred (T8, the `CONTEXT.md`
 * open question), so nothing here is owed off the back of it.
 *
 * The transaction is here and not in the Server Action, by convention 5 beside this package: for
 * online the status and the teacher rows commit together or not at all. `for update` on the Session
 * is what makes the status check mean something — two Staff pressing the button at once both read
 * `arranged` otherwise, and the second overwrites the first.
 */
export async function markSessionDelivered(
  caller: Person,
  sessionId: string,
  teachers: TaughtBy[],
): Promise<MarkDeliveredResult> {
  requireStaff(caller);

  return db.transaction(async (tx) => {
    const { status, mode } = await lockedSession(tx, sessionId);
    if (status !== "arranged") return { outcome: "not-arranged", status };

    if (mode === "offline") {
      // Status only — no who-taught, no `session_teacher`. The Stream is on the Session and the
      // teachers are `session_teaching_team` names, not People.
      await tx.update(session).set({ status: "delivered" }).where(eq(session.id, sessionId));
      return { outcome: "delivered" };
    }

    const missing = streamsUnnamed(teachers);
    if (missing.length > 0) return { outcome: "stream-unnamed", missing };

    await replaceTeachers(tx, sessionId, teachers);
    await tx.update(session).set({ status: "delivered" }).where(eq(session.id, sessionId));

    return { outcome: "delivered" };
  });
}

/**
 * Correct who taught, which stays possible **after** delivery and stays Staff-only.
 *
 * It has to: `delivered` is terminal, so there is no un-delivering a Session to fix a
 * name, and until a mis-named professor is removed they owe three Class Records they
 * cannot honestly file.
 *
 * **The both-Streams rule is re-checked once the Session is delivered, and not before.**
 * Naming is optional at arrangement — mandatory at arrangement would block a batch
 * whenever one professor is not yet fixed, which is the ordinary case — but a delivered
 * Session that could be emptied here would make removing a professor the way out of the
 * rule Tandai terlaksana had just enforced.
 */
export async function correctSessionTeachers(
  caller: Person,
  sessionId: string,
  teachers: TaughtBy[],
): Promise<CorrectTeachersResult> {
  requireStaff(caller);

  return db.transaction(async (tx) => {
    const { status, mode } = await lockedSession(tx, sessionId);
    // Offline teaching is `session_teaching_team` names, corrected on the Perjadin — never
    // `session_teacher`. Refuse before any write so an offline Session gets no teacher row.
    if (mode === "offline") return { outcome: "offline-not-correctable" };
    // Nobody taught a Session that was called off, so there is nothing to correct the
    // record of. The rows this would otherwise write are invisible as well as meaningless
    // — `owed` reports nothing until a Session is delivered — which is what would make
    // them survive.
    if (status === "cancelled") return { outcome: "not-correctable", status };

    if (status === "delivered") {
      const missing = streamsUnnamed(teachers);
      if (missing.length > 0) return { outcome: "stream-unnamed", missing };
    }

    await replaceTeachers(tx, sessionId, teachers);
    return { outcome: "corrected" };
  });
}

/**
 * **Batalkan Sesi** — offered only while the Session is `arranged`.
 *
 * Once delivered it happened, and "un-delivering" is a correction rather than a
 * cancellation: conflating the two would put a reason field on an event that already has
 * one, and would leave filed Class Records describing a Session that claims not to have
 * happened.
 *
 * The reason travels in the same write because `session_cancelled_iff_reason` refuses the
 * pair apart. A blank one is caught here rather than at the database, so it reads as a
 * required field and not as an error page.
 */
export async function cancelSession(
  caller: Person,
  sessionId: string,
  reason: string,
): Promise<CancelSessionResult> {
  requireStaff(caller);

  const cancelledReason = reason.trim();
  if (cancelledReason === "") return { outcome: "reason-required" };

  return db.transaction(async (tx) => {
    const { status } = await lockedSession(tx, sessionId);
    if (status !== "arranged") return { outcome: "not-arranged", status };

    await tx
      .update(session)
      .set({ status: "cancelled", cancelledReason })
      .where(eq(session.id, sessionId));

    return { outcome: "cancelled" };
  });
}

/**
 * Move an arranged Session's date. **A slipped date is not a cancellation** — it demands
 * no reason and leaves no dead row on the School's list.
 *
 * Cancel-and-re-arrange was the alternative and the schema does permit it, both partial
 * unique indexes being predicated on `status <> 'cancelled'` for exactly that. It was
 * rejected for cost rather than for feasibility.
 *
 * The two modes are refused by different rules, and both are checked:
 *
 * - **Online** — the new date must not collide with another online Session for the same
 *   School. That is `session_one_online_per_school_per_day`, and it is left to refuse the
 *   write rather than pre-read: a pre-read is a race, and the index is not.
 * - **Offline** — the new date must stay inside the Perjadin's window. No CHECK can carry
 *   that, since the range sits on another table, so it is held here beside the write.
 *
 * **The start time moves with the date, in the same write** ([#72](https://github.com/mafiefa02/sugt/issues/72)):
 * moving a Session is one act, and a dialog that changed the date while silently keeping a
 * time nobody can see would be a trap. The index keys on `(school_id, held_on)`, not
 * `starts_at`, so the collision rule is unaffected by carrying the time.
 */
export async function moveSessionDate(
  caller: Person,
  sessionId: string,
  heldOn: string,
  startsAt: string,
): Promise<MoveSessionDateResult> {
  requireStaff(caller);

  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          status: session.status,
          startsOn: perjadin.startsOn,
          endsOn: perjadin.endsOn,
        })
        .from(session)
        .leftJoin(perjadin, eq(perjadin.id, session.perjadinId))
        .where(eq(session.id, sessionId))
        .for("update", { of: session });
      // The one status read that is not `lockedSession`, because it needs the Perjadin's
      // window in the same locked read. A missing row throws for the same reason.
      if (!row) {
        throw new Error(
          `No Session has id ${sessionId}. Detail Sesi 404s on an unknown id before ` +
            "offering any write, and nothing deletes a Session, so this is a bug or a " +
            "hand-edited request.",
        );
      }
      if (row.status !== "arranged") return { outcome: "not-arranged", status: row.status };

      // An offline Session always has a Perjadin, by `session_offline_iff_perjadin`, so
      // this narrows to "this is the offline case" rather than to "the join found a row".
      if (row.startsOn !== null && row.endsOn !== null) {
        const window = { startsOn: row.startsOn, endsOn: row.endsOn };
        if (!heldOnWithinPerjadin(heldOn, window)) {
          return { outcome: "outside-perjadin", ...window };
        }
      }

      await tx.update(session).set({ heldOn, startsAt }).where(eq(session.id, sessionId));
      return { outcome: "moved" };
    });
  } catch (error) {
    // Named rather than caught wholesale: this row satisfies five CHECKs and two composite
    // foreign keys, and swallowing any of those as "that date is taken" would report a bug
    // as a user state.
    const constraint = (error as { cause?: { constraint_name?: string } }).cause?.constraint_name;
    if (constraint === "session_one_online_per_school_per_day") {
      return { outcome: "collided", constraint };
    }
    throw error;
  }
}
