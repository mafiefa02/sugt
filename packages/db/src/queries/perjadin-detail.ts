import type { Role, SessionStatus, Stream } from "@sugt/domain";
import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "../client";
import { session } from "../schema/delivery";
import { person } from "../schema/people";
import { school } from "../schema/reference";
import { groupMember, perjadin } from "../schema/travel";
import type { Person } from "./caller";
import { duplicatedTeachers, streamsUncovered, type PlannedTeacher } from "./group-rules";
import { heldOnWithinPerjadin } from "./session-detail";
import { requireStaff } from "./staff-only";

/**
 * **One Perjadin, and the one write on it** — open to anyone signed in, and carrying no
 * money at all.
 *
 * That last part is the Teaching Team variant, and it is a **shape** rather than a
 * rendering rule. The criterion asks for the Advance strip, the transactions and the
 * Report to be *absent, not disabled*; the way to make that true is for the payload never
 * to carry them. Money is `./perjadin-report.ts`'s `perjadinAcquittal`, which opens with
 * the Staff-only choke point — so a professor's screen is money that was never fetched,
 * not money hidden on the way out. Nothing here needs a role check, because there is
 * nothing here to refuse.
 */

/** One member of the Group. Staff carry no Stream; Teaching Team always carry one. */
export type GroupMemberEntry = {
  personId: string;
  fullName: string;
  role: Role;
  stream: Stream | null;
};

/** One School on the trip, and how its Session is going. */
export type PerjadinSession = {
  sessionId: string;
  schoolName: string;
  schoolSlug: string;
  heldOn: string;
  status: SessionStatus;
};

/** Everything the Perjadin detail screen renders, and no money. */
export type PerjadinDetail = {
  id: string;
  destination: string;
  startsOn: string;
  endsOn: string;
  picPersonId: string;
  picFullName: string;
  /**
   * **The Report deadline is not here.** It is on `perjadinAcquittal`, behind the
   * Staff-only choke point, because the Perjadin Report *is* the acquittal —
   * `docs/data-model.md` says so in as many words — and the criterion puts the Report among
   * what is absent for a Teaching Team member. A due date for a document a professor will
   * never open is nothing to them, and leaving it here would make it the one of the three
   * they could still see.
   */
  group: GroupMemberEntry[];
  sessions: PerjadinSession[];
  /**
   * Every active Teaching Team member, for the substitution dialog's pickers.
   *
   * The roster and not the Group: substituting means naming somebody who is **not** on the
   * trip yet, so offering only the current members would make the one act this screen
   * exists for impossible.
   */
  teachingTeam: { id: string; fullName: string }[];
};

/**
 * One Perjadin, or `null` when the id names none — a stale link, which is reachable, and
 * which the screen turns into a 404.
 *
 * Three statements, because a trip is a header with two independent lists hanging off it
 * and joining both at once would multiply the rows of each by the other. `Promise.all`
 * keeps them concurrent; the screen still makes one call and assembles nothing.
 */
export async function perjadinDetail(
  _caller: Person,
  perjadinId: string,
): Promise<PerjadinDetail | null> {
  const pic = alias(person, "pic");

  const [[trip], group, sessions, teachingTeam] = await Promise.all([
    db
      .select({
        id: perjadin.id,
        destination: perjadin.destination,
        startsOn: perjadin.startsOn,
        endsOn: perjadin.endsOn,
        picPersonId: pic.id,
        picFullName: pic.fullName,
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
      // Staff first, then professors by name: the PIC is who a reader looks for.
      .orderBy(asc(groupMember.role), asc(person.fullName)),
    db
      .select({
        sessionId: session.id,
        schoolName: school.name,
        schoolSlug: school.slug,
        heldOn: session.heldOn,
        status: session.status,
      })
      .from(session)
      .innerJoin(school, eq(school.id, session.schoolId))
      .where(eq(session.perjadinId, perjadinId))
      .orderBy(asc(session.heldOn), asc(school.name)),
    // Revoked People are not offered: naming one puts them on a trip they are no longer on.
    db
      .select({ id: person.id, fullName: person.fullName })
      .from(person)
      .where(and(eq(person.active, true), eq(person.role, "Teaching Team")))
      .orderBy(asc(person.fullName)),
  ]);

  if (!trip) return null;

  return { ...trip, group, sessions, teachingTeam };
}

export type ReplaceGroupResult =
  | { outcome: "replaced" }
  | { outcome: "stream-uncovered"; missing: Stream[] }
  | { outcome: "duplicate-teacher"; personIds: string[] }
  /** The id names no Perjadin — a stale link, which is reachable. */
  | { outcome: "no-such-perjadin" };

/**
 * Replace a Group whole.
 *
 * **Substituting a professor submits an entire replacement Group**, and one transaction
 * deletes every member row and inserts the new set. The Perjadin keeps its id, so its
 * Sessions, its Advance and its transactions are untouched — which is the whole reason
 * this is a replacement rather than a delete-and-recreate.
 *
 * Wholesale replacement is also what makes the Stream-cover rule checkable, and
 * `docs/data-model.md` says so: the check runs once against the complete payload and there
 * is no partial state for it to miss.
 *
 * **The PIC is re-inserted rather than asked for.** They are the one member the caller
 * cannot choose — `perjadin_pic_is_a_group_member` would refuse a Group without them at
 * COMMIT, and asking a substitution form for the PIC it must not change would be offering
 * a field with one legal value.
 */
export async function replacePerjadinGroup(
  caller: Person,
  perjadinId: string,
  teachers: PlannedTeacher[],
): Promise<ReplaceGroupResult> {
  requireStaff(caller);

  const missing = streamsUncovered(teachers);
  if (missing.length > 0) return { outcome: "stream-uncovered", missing };

  const duplicated = duplicatedTeachers(teachers);
  if (duplicated.length > 0) return { outcome: "duplicate-teacher", personIds: duplicated };

  return db.transaction(async (tx) => {
    const [trip] = await tx
      .select({ picPersonId: perjadin.picPersonId })
      .from(perjadin)
      .where(eq(perjadin.id, perjadinId))
      .for("update");
    if (!trip) return { outcome: "no-such-perjadin" };

    // **What a member keeps across a replacement.** `receiptsSettledAt` is the PIC's
    // checklist — an explicit mark that somebody handed their receipts over, which cannot be
    // derived, because a member with no transactions is ambiguous between *spent nothing*
    // and *has not handed anything over yet*. Deleting and re-inserting a professor who is
    // still on the trip would silently clear it, and the PIC would have no way to know.
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
      ...teachers
        // The PIC is Staff and cannot be a professor, so this drops nothing a valid form
        // could send. It is here because the pair would otherwise violate the primary key
        // on `(perjadin_id, person_id)` and read as a crash.
        .filter((teacher) => teacher.personId !== trip.picPersonId)
        .map((teacher) => ({
          perjadinId,
          personId: teacher.personId,
          role: "Teaching Team" as const,
          stream: teacher.stream,
          // Null for somebody joining the Group, which is right: they have handed nothing
          // over yet because they were not on the trip.
          receiptsSettledAt: settled.get(teacher.personId) ?? null,
        })),
    ]);

    return { outcome: "replaced" };
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
