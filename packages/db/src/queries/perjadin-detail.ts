import {
  MAX_EXTRA_STAFF_PER_GROUP,
  PIMPINAN,
  type Role,
  type SessionStatus,
  type Stream,
  type TimeZone,
  type TransportMode,
} from "@sugt/domain";
import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "../client";
import { session, sessionTeachingTeam } from "../schema/delivery";
import { person } from "../schema/people";
import { province, school } from "../schema/reference";
import {
  groupMember,
  perjadin,
  perjadinPimpinan,
  perjadinPreparationItem,
  perjadinTeacher,
} from "../schema/travel";
import type { Person } from "./caller";
import { duplicatedStaff } from "./group-rules";
import {
  derivePreparationChecklist,
  type PreparationItem,
  type PreparationTeacher,
} from "./preparation-checklist";
import { heldOnWithinPerjadin } from "./session-detail";
import { requireStaff } from "./staff-only";

/**
 * **One Perjadin, and the writes on it** — the read open to anyone signed in and carrying no
 * money at all; the writes Staff-only.
 *
 * The no-money part is the Teaching Team variant, and it is a **shape** rather than a rendering
 * rule. The criterion asks for the Advance strip, the transactions and the Report to be *absent, not
 * disabled*; the way to make that true is for the payload never to carry them. Money is
 * `./perjadin-report.ts`'s `perjadinAcquittal`, which opens with the Staff-only choke point — so a
 * professor's screen is money that was never fetched, not money hidden on the way out. The read here
 * needs no role check, because there is nothing here to refuse; every **write** below opens with
 * `requireStaff`.
 */

/** One member of the Group. Staff-only now (ADR-0020), so `stream` is always null. */
export type GroupMemberEntry = {
  personId: string;
  fullName: string;
  role: Role;
  stream: Stream | null;
};

/** One offline Session on the trip, and how it is going. */
export type PerjadinSession = {
  sessionId: string;
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  heldOn: string;
  /** Wall-clock start time local to the School (`HH:MM:SS`), rendered with its zone. */
  startsAt: string;
  /** The School's Province's Time Zone, for rendering `startsAt`. */
  timeZone: TimeZone;
  status: SessionStatus;
  /** The Stream this Session teaches — STEM or Research (ADR-0019). Never null on an offline row. */
  stream: Stream | null;
  /** The trip's teacher names who staffed this Session's parallel rooms, for editing "Diajar oleh". */
  taughtBy: { id: string; name: string }[];
};

/**
 * One leg's travel logistics, as the detail screen reads them. Null on every Perjadin planned
 * before the columns existed (#106) — the screen shows those legs as not recorded.
 */
export type PerjadinTravelLeg = {
  /** Wall-clock date and time, `YYYY-MM-DD HH:MM:SS`, meaningful only beside `zone`. */
  at: string;
  zone: TimeZone;
  mode: TransportMode;
};

/** A School eligible to hold a Session on this trip — one of the trip's Sub-Cluster's Schools. */
export type EligibleSchool = {
  id: string;
  name: string;
  kabupatenKota: string;
};

/** Everything the Perjadin detail screen renders, and no money. */
export type PerjadinDetail = {
  id: string;
  destination: string;
  startsOn: string;
  endsOn: string;
  picPersonId: string;
  picFullName: string;
  /** Departure from Bandung; null when this trip predates the logistics columns. */
  departure: PerjadinTravelLeg | null;
  /** Return; null when this trip predates the logistics columns. */
  return: PerjadinTravelLeg | null;
  /**
   * **The Report deadline is not here.** It is on `perjadinAcquittal`, behind the
   * Staff-only choke point, because the Perjadin Report *is* the acquittal —
   * `docs/data-model.md` says so in as many words — and the criterion puts the Report among
   * what is absent for a Teaching Team member.
   */
  group: GroupMemberEntry[];
  sessions: PerjadinSession[];
  /** The trip's Teaching Team as trip-scoped names (ADR-0020), for the per-name editor and the "Diajar oleh" pickers. */
  teachers: { id: string; name: string }[];
  /** The Pimpinan recorded on the trip, for the checkbox editor. A subset of the fixed three. */
  pimpinan: string[];
  /**
   * Every active Staff member, for the PIC picker and the extra-Staff multi-select. Revoked People
   * are not offered — naming one puts them on a trip they are no longer on.
   */
  staff: { id: string; fullName: string }[];
  /** The Schools of the trip's Sub-Cluster, for the "add a Session" picker (ADR-0016's eligible set). */
  eligibleSchools: EligibleSchool[];
  /**
   * The Preparation Checklist, each item with its tick state ([#114](https://github.com/mafiefa02/sugt/issues/114)).
   * **Derived here, not stored**: `perjadin_preparation_item` holds only the ticks. Its per-teacher
   * derivation is T4's ([#139](https://github.com/mafiefa02/sugt/issues/139)); this ticket leaves it
   * as it stands. No money, so it rides on this open payload rather than the Staff-only acquittal.
   */
  preparation: PreparationItem[];
};

/**
 * One Perjadin, or `null` when the id names none — a stale link, which is reachable, and
 * which the screen turns into a 404.
 *
 * A header with several independent lists hanging off it, gathered concurrently with `Promise.all`
 * rather than joined at once — joining every list into one statement would multiply each list's rows
 * by the others'. The screen still makes one call and assembles nothing.
 */
export async function perjadinDetail(
  _caller: Person,
  perjadinId: string,
): Promise<PerjadinDetail | null> {
  const pic = alias(person, "pic");

  const [
    [trip],
    group,
    sessions,
    teachers,
    pimpinan,
    staff,
    eligibleSchools,
    teachingLinks,
    preparationTicks,
  ] = await Promise.all([
    db
      .select({
        id: perjadin.id,
        destination: perjadin.destination,
        startsOn: perjadin.startsOn,
        endsOn: perjadin.endsOn,
        picPersonId: pic.id,
        picFullName: pic.fullName,
        departureAt: perjadin.departureAt,
        departureZone: perjadin.departureZone,
        departureMode: perjadin.departureMode,
        returnAt: perjadin.returnAt,
        returnZone: perjadin.returnZone,
        returnMode: perjadin.returnMode,
      })
      .from(perjadin)
      .innerJoin(pic, eq(pic.id, perjadin.picPersonId))
      .where(eq(perjadin.id, perjadinId)),
    db
      .select({
        personId: groupMember.personId,
        fullName: person.fullName,
        role: groupMember.role,
        stream: groupMember.stream,
      })
      .from(groupMember)
      .innerJoin(person, eq(person.id, groupMember.personId))
      .where(eq(groupMember.perjadinId, perjadinId))
      // The PIC is who a reader looks for; among the Staff-only Group, name order otherwise.
      .orderBy(asc(person.fullName)),
    db
      .select({
        sessionId: session.id,
        schoolId: session.schoolId,
        schoolName: school.name,
        schoolSlug: school.slug,
        heldOn: session.heldOn,
        startsAt: session.startsAt,
        timeZone: province.timeZone,
        status: session.status,
        stream: session.stream,
      })
      .from(session)
      .innerJoin(school, eq(school.id, session.schoolId))
      .innerJoin(province, eq(province.code, school.provinceCode))
      .where(eq(session.perjadinId, perjadinId))
      .orderBy(asc(session.heldOn), asc(session.startsAt), asc(school.name)),
    // The trip's Teaching Team names, in name order, for the editor and the "Diajar oleh" pickers.
    db
      .select({ id: perjadinTeacher.id, name: perjadinTeacher.name })
      .from(perjadinTeacher)
      .where(eq(perjadinTeacher.perjadinId, perjadinId))
      .orderBy(asc(perjadinTeacher.name)),
    // The Pimpinan recorded on the trip — record-only names, a subset of the fixed three.
    db
      .select({ name: perjadinPimpinan.name })
      .from(perjadinPimpinan)
      .where(eq(perjadinPimpinan.perjadinId, perjadinId)),
    // The Staff roster, for the PIC picker and the extra-Staff multi-select. Revoked People excluded.
    db
      .select({ id: person.id, fullName: person.fullName })
      .from(person)
      .where(and(eq(person.active, true), eq(person.role, "Staff")))
      .orderBy(asc(person.fullName)),
    // The Schools of the trip's Sub-Cluster — the set a new Session may be added at (ADR-0016).
    db
      .select({ id: school.id, name: school.name, kabupatenKota: school.kabupatenKota })
      .from(school)
      .innerJoin(perjadin, eq(perjadin.subClusterId, school.subClusterId))
      .where(eq(perjadin.id, perjadinId))
      .orderBy(asc(school.name)),
    // "Diajar oleh" for every Session on the trip: the teacher rows those Sessions link to. Scoped
    // to this trip by `perjadin_teacher.perjadin_id`, so a link's Session belongs to it too.
    db
      .select({
        sessionId: sessionTeachingTeam.sessionId,
        teacherId: perjadinTeacher.id,
        teacherName: perjadinTeacher.name,
      })
      .from(sessionTeachingTeam)
      .innerJoin(perjadinTeacher, eq(perjadinTeacher.id, sessionTeachingTeam.perjadinTeacherId))
      .where(eq(perjadinTeacher.perjadinId, perjadinId))
      .orderBy(asc(perjadinTeacher.name)),
    db
      .select({
        itemKey: perjadinPreparationItem.itemKey,
        checkedBy: perjadinPreparationItem.checkedBy,
        checkedAt: perjadinPreparationItem.checkedAt,
      })
      .from(perjadinPreparationItem)
      .where(eq(perjadinPreparationItem.perjadinId, perjadinId)),
  ]);

  if (!trip) return null;

  // "Diajar oleh" stitched onto each Session — the links are already scoped to the trip and ordered
  // by teacher name.
  const taughtBySession = new Map<string, { id: string; name: string }[]>();
  for (const link of teachingLinks) {
    const list = taughtBySession.get(link.sessionId) ?? [];
    list.push({ id: link.teacherId, name: link.teacherName });
    taughtBySession.set(link.sessionId, list);
  }

  // The Preparation Checklist's per-teacher boxes are still keyed off the Group's Teaching Team
  // members, which is empty now that the Group is Staff-only — redefining the item is T4/#139, so
  // this is left as it stands and yields the six fixed items.
  const preparationTeachers: PreparationTeacher[] = group
    .filter((member) => member.role === "Teaching Team")
    .map((member) => ({ personId: member.personId, fullName: member.fullName }));
  const preparation = derivePreparationChecklist(preparationTeachers, preparationTicks);

  const { departureAt, departureZone, departureMode, returnAt, returnZone, returnMode, ...header } =
    trip;

  return {
    ...header,
    // A leg reads as recorded only when all three of its columns are present. They are written
    // together and the CHECKs pin the zone/mode, so in practice they are all-or-nothing.
    departure:
      departureAt !== null && departureZone !== null && departureMode !== null
        ? { at: departureAt, zone: departureZone, mode: departureMode }
        : null,
    return:
      returnAt !== null && returnZone !== null && returnMode !== null
        ? { at: returnAt, zone: returnZone, mode: returnMode }
        : null,
    group,
    sessions: sessions.map((row) => ({
      ...row,
      taughtBy: taughtBySession.get(row.sessionId) ?? [],
    })),
    teachers,
    pimpinan: pimpinan.map((row) => row.name),
    staff,
    eligibleSchools,
    preparation,
  };
}

export type SetPerjadinStaffResult =
  | { outcome: "set" }
  /** More than `MAX_EXTRA_STAFF_PER_GROUP` extra Staff — the Group is the PIC plus up to ten. */
  | { outcome: "too-many-staff"; count: number; limit: number }
  /** An extra Staff member repeated, or the same as the PIC — a Group holds each person once. */
  | { outcome: "duplicate-staff"; personIds: string[] }
  /** The id names no Perjadin — a stale link, which is reachable. */
  | { outcome: "no-such-perjadin" };

/**
 * **Set the Group's extra Staff** — the PIC plus this set, and nobody else.
 *
 * This replaced the wholesale `replacePerjadinGroup` when the Teaching Team left the Group
 * (ADR-0020): a Group is Staff and only Staff now, so editing it is choosing the extra Staff. The
 * set is written whole, the same way planning writes it — up to ten distinct Staff, none the PIC —
 * because the caps and the distinctness are counts across sibling rows no CHECK can hold.
 *
 * **The PIC is re-inserted rather than asked for.** They are the one member the caller cannot drop —
 * `perjadin_pic_is_a_group_member` refuses a Group without them at COMMIT — and the PIC is changed
 * through `changePerjadinPic`, not here. A staying member's `receiptsSettledAt` is preserved across
 * the rewrite, because a member with transactions still owes their receipts afterwards.
 */
export async function setPerjadinStaff(
  caller: Person,
  perjadinId: string,
  staffPersonIds: string[],
): Promise<SetPerjadinStaffResult> {
  requireStaff(caller);

  if (staffPersonIds.length > MAX_EXTRA_STAFF_PER_GROUP) {
    return {
      outcome: "too-many-staff",
      count: staffPersonIds.length,
      limit: MAX_EXTRA_STAFF_PER_GROUP,
    };
  }

  return db.transaction(async (tx) => {
    const [trip] = await tx
      .select({ picPersonId: perjadin.picPersonId })
      .from(perjadin)
      .where(eq(perjadin.id, perjadinId))
      .for("update");
    if (!trip) return { outcome: "no-such-perjadin" };

    const duplicate = duplicatedStaff(trip.picPersonId, staffPersonIds);
    if (duplicate.length > 0) return { outcome: "duplicate-staff", personIds: duplicate };

    const settled = new Map(
      (
        await tx
          .select({ personId: groupMember.personId, settledAt: groupMember.receiptsSettledAt })
          .from(groupMember)
          .where(eq(groupMember.perjadinId, perjadinId))
      ).map((member) => [member.personId, member.settledAt]),
    );

    await tx.delete(groupMember).where(eq(groupMember.perjadinId, perjadinId));
    await tx.insert(groupMember).values([
      {
        perjadinId,
        personId: trip.picPersonId,
        role: "Staff" as const,
        stream: null,
        receiptsSettledAt: settled.get(trip.picPersonId) ?? null,
      },
      ...staffPersonIds.map((personId) => ({
        perjadinId,
        personId,
        role: "Staff" as const,
        stream: null,
        receiptsSettledAt: settled.get(personId) ?? null,
      })),
    ]);

    return { outcome: "set" };
  });
}

export type ChangePerjadinPicResult =
  | { outcome: "changed" }
  /** The id names no Perjadin — a stale link, which is reachable. */
  | { outcome: "no-such-perjadin" };

/**
 * **Reassign a Perjadin's PIC**, keeping the Group valid.
 *
 * Two writes in one transaction: `perjadin.pic_person_id` moves to the new PIC, and the new PIC is
 * made a `group_member` if they are not one already. It has to be one transaction because
 * `perjadin_pic_is_a_group_member` — the DEFERRABLE self-referential foreign key — must hold at
 * COMMIT: the `perjadin` update runs **first**, while the new PIC is not yet a member, which an
 * immediate check would refuse and the deferral lets pass; the membership insert then satisfies it
 * before COMMIT. The old PIC stays on the Group as an ordinary Staff member, droppable afterwards
 * through `setPerjadinStaff`.
 *
 * A new PIC who is not Staff is refused by `perjadin_pic_is_staff` at the database, which is not
 * reachable from the picker (it offers active Staff only) and so throws rather than returning a
 * value — the same disposition planning gives a professor named PIC.
 */
export async function changePerjadinPic(
  caller: Person,
  perjadinId: string,
  newPicPersonId: string,
): Promise<ChangePerjadinPicResult> {
  requireStaff(caller);

  return db.transaction(async (tx) => {
    const [trip] = await tx
      .select({ picPersonId: perjadin.picPersonId })
      .from(perjadin)
      .where(eq(perjadin.id, perjadinId))
      .for("update");
    if (!trip) return { outcome: "no-such-perjadin" };
    if (trip.picPersonId === newPicPersonId) return { outcome: "changed" };

    // The `perjadin` update goes first, before the new PIC is a member — legal only because the
    // membership foreign key is DEFERRED to COMMIT.
    await tx
      .update(perjadin)
      .set({ picPersonId: newPicPersonId })
      .where(eq(perjadin.id, perjadinId));
    await tx
      .insert(groupMember)
      .values({ perjadinId, personId: newPicPersonId, role: "Staff" as const, stream: null })
      // Already a member — the new PIC was an extra Staff — is the common case, and idempotent here.
      .onConflictDoNothing();

    return { outcome: "changed" };
  });
}

export type SetPerjadinPimpinanResult =
  | { outcome: "set" }
  /** A name outside the fixed three. Not reachable through the checkbox editor, checked anyway. */
  | { outcome: "unknown-pimpinan"; offending: string[] }
  /** The id names no Perjadin — a stale link, which is reachable. */
  | { outcome: "no-such-perjadin" };

/**
 * **Set the Pimpinan recorded on a trip** — the subset of the fixed three who joined. Staff-only.
 *
 * Record-only rows (ADR-0020): a Pimpinan is not a `group_member`, files no Perjadin Evaluation and
 * adds nothing to the Preparation Checklist. The set is written whole — removed names deleted, added
 * ones inserted — deduped so the `(perjadin_id, name)` primary key cannot collide. A name outside
 * `PIMPINAN` is refused before any write, the way planning refuses it, rather than surfaced as the
 * raw `perjadin_pimpinan_name_check` violation the database would also raise.
 */
export async function setPerjadinPimpinan(
  caller: Person,
  perjadinId: string,
  names: string[],
): Promise<SetPerjadinPimpinanResult> {
  requireStaff(caller);

  const unique = [...new Set(names)];
  const unknown = unique.filter((name) => !(PIMPINAN as readonly string[]).includes(name));
  if (unknown.length > 0) return { outcome: "unknown-pimpinan", offending: unknown };

  return db.transaction(async (tx) => {
    const [trip] = await tx
      .select({ id: perjadin.id })
      .from(perjadin)
      .where(eq(perjadin.id, perjadinId))
      .for("update");
    if (!trip) return { outcome: "no-such-perjadin" };

    await tx.delete(perjadinPimpinan).where(eq(perjadinPimpinan.perjadinId, perjadinId));
    if (unique.length > 0) {
      await tx.insert(perjadinPimpinan).values(unique.map((name) => ({ perjadinId, name })));
    }

    return { outcome: "set" };
  });
}

// Calendar-day arithmetic on the `YYYY-MM-DD` strings the `date` columns hold. Both helpers
// work at UTC midnight, so the calculation stays in one zone and a Session — a calendar day,
// not an instant — never drifts across a boundary.
const MS_PER_DAY = 86_400_000;

function daysBetween(from: string, to: string): number {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY;
}

function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

export type MovePerjadinDatesResult =
  | { outcome: "moved"; sessionsShifted: number }
  /** At least one arranged Session would fall outside the new window; nothing was changed. */
  | { outcome: "would-strand"; strandedCount: number; startsOn: string; endsOn: string }
  | { outcome: "no-such-perjadin" };

/**
 * Moving a trip's dates shifts its arranged Sessions, or is refused whole.
 *
 * The offset is measured from the trip's **start**: each arranged Session moves by the same
 * number of days `startsOn` moved, so a Session on day two of the trip stays on day two. A pure
 * translation (start and end move together) keeps every arranged Session inside the new window by
 * construction; a resize can push one out, and then the whole edit is refused rather than
 * stranding it — one write must not leave a trip whose dates moved but whose Sessions did not.
 *
 * Only **arranged** Sessions move. A delivered or cancelled Session records something that
 * already happened, so it may legitimately sit outside the window its trip now claims — which is
 * why the invariant is scoped to arranged (see `docs/data-model.md`, Delivery). Online Sessions
 * carry no `perjadin_id` and so are never among these.
 *
 * An inverted window (`startsOn` after `endsOn`) is a precondition violation, not a user state:
 * the edit surface validates it and `perjadin_dates_check` would refuse it, so it throws rather
 * than returning an outcome.
 */
export async function movePerjadinDates(
  caller: Person,
  perjadinId: string,
  startsOn: string,
  endsOn: string,
): Promise<MovePerjadinDatesResult> {
  requireStaff(caller);
  if (startsOn > endsOn) {
    throw new Error(
      `movePerjadinDates got startsOn ${startsOn} after endsOn ${endsOn}. The edit surface ` +
        "validates the window before calling, and perjadin_dates_check would refuse it, so this " +
        "is a bug or a hand-edited request rather than a user state.",
    );
  }

  return db.transaction(async (tx) => {
    const [trip] = await tx
      .select({ startsOn: perjadin.startsOn, endsOn: perjadin.endsOn })
      .from(perjadin)
      .where(eq(perjadin.id, perjadinId))
      .for("update");
    if (!trip) return { outcome: "no-such-perjadin" };

    const offsetDays = daysBetween(trip.startsOn, startsOn);

    // Offline arranged Sessions on this trip; online ones carry no `perjadin_id`, so the
    // `perjadin_id` match already excludes them.
    const arranged = await tx
      .select({ id: session.id, heldOn: session.heldOn })
      .from(session)
      .where(and(eq(session.perjadinId, perjadinId), eq(session.status, "arranged")))
      .for("update", { of: session });

    const window = { startsOn, endsOn };
    const shifted = arranged.map((s) => ({ id: s.id, heldOn: shiftDate(s.heldOn, offsetDays) }));
    const stranded = shifted.filter((s) => !heldOnWithinPerjadin(s.heldOn, window));
    if (stranded.length > 0) {
      // Return before any write: the transaction commits, but it carries only the locking
      // reads, so the trip and its Sessions are left exactly as they were.
      return { outcome: "would-strand", strandedCount: stranded.length, startsOn, endsOn };
    }

    await tx.update(perjadin).set({ startsOn, endsOn }).where(eq(perjadin.id, perjadinId));
    for (const shift of shifted) {
      await tx.update(session).set({ heldOn: shift.heldOn }).where(eq(session.id, shift.id));
    }
    return { outcome: "moved", sessionsShifted: shifted.length };
  });
}

/**
 * The six logistics fields as the edit surface submits them. Unlike the plan form, the return
 * **zone is explicit here** — it was derived from the last School at plan time, but a correction
 * may be needed. The departure zone stays WIB (the origin is always Bandung), so it is not asked
 * for and not accepted: the query fixes it.
 */
export type PerjadinLogisticsInput = {
  departureDate: string;
  departureTime: string;
  departureMode: TransportMode;
  returnDate: string;
  returnTime: string;
  returnMode: TransportMode;
  returnZone: TimeZone;
};

export type UpdatePerjadinLogisticsResult =
  | { outcome: "updated" }
  /** The id names no Perjadin — a stale link, which is reachable. */
  | { outcome: "no-such-perjadin" };

/**
 * Correct a Perjadin's departure/return logistics after planning. Staff-only, like the date edit.
 *
 * Writes all six columns at once. `departure_zone` is fixed to WIB and never taken from the
 * caller; `return_zone` is the caller's, because a return from a WITA/WIT city is read in that
 * city's wall-clock and the derivation at plan time can be wrong. The `*_at` values are wall-clock
 * `date time` strings, the same shape planning wrote — no instant, no conversion.
 */
export async function updatePerjadinLogistics(
  caller: Person,
  perjadinId: string,
  input: PerjadinLogisticsInput,
): Promise<UpdatePerjadinLogisticsResult> {
  requireStaff(caller);

  const [updated] = await db
    .update(perjadin)
    .set({
      departureAt: `${input.departureDate} ${input.departureTime}`,
      departureZone: "WIB",
      departureMode: input.departureMode,
      returnAt: `${input.returnDate} ${input.returnTime}`,
      returnZone: input.returnZone,
      returnMode: input.returnMode,
    })
    .where(eq(perjadin.id, perjadinId))
    .returning({ id: perjadin.id });

  return updated ? { outcome: "updated" } : { outcome: "no-such-perjadin" };
}
