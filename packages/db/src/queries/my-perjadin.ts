import type { SessionStatus, TimeZone } from "@sugt/domain";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "../client";
import { session } from "../schema/delivery";
import { person } from "../schema/people";
import { province, school } from "../schema/reference";
import {
  groupMember,
  perjadin,
  perjadinPimpinan,
  perjadinPreparationItem,
  perjadinTeacher,
  transaction,
} from "../schema/travel";
import { advanceDrawdownCategoryList } from "./advance-drawdown";
import type { Person } from "./caller";
import { DEADLINE_TIME_ZONE, perjadinReportDeadline, todayInDeadlineZone } from "./deadline";
import {
  derivePreparationChecklist,
  type PreparationItem,
  type PreparationTick,
} from "./preparation-checklist";

/**
 * **The caller's own trips**, for `/pendamping` (#197, #396): Perjalanan Dinas Anda — the trips not
 * yet over — and Perjalanan Dinas Sebelumnya — the ones that are, still fully workable, since the
 * Laporan and the attendance sheets are often finished after the trip.
 *
 * A read scoped **by** the caller rather than gated by their role: it takes a `Person` and returns
 * only the trips that Person is a working member of, so there is no Staff choke point (every
 * signed-in Person is Staff since T3, and a delivery read is open anyway). "Their trips" is
 * membership, not the PIC seat — the PIC is *a* `group_member` too (`perjadin_pic_is_a_group_member`
 * guarantees it), so joining `group_member` on `person_id = caller.id` already includes the trips
 * they lead and drops the trips they are merely PIC-eligible for but not on. There is no separate
 * `perjadin_pimpinan` path: a Pimpinan is record-only (ADR-0025) and this is a working-member view.
 *
 * **Money rides on this payload**, unlike `./perjadin-detail.ts` which carries none. This is a
 * personal work list — "how much of my Advance is left" is the point of it — and money reads are
 * open now (ADR-0026), so `advanceIdr`/`drawnDownIdr` sit here directly rather than behind a second call.
 */

/** One Staff member of the trip's Group. `isPic` flags the one the reader looks for first. */
export type MyPerjadinStaff = {
  personId: string;
  fullName: string;
  isPic: boolean;
};

/** One trip-scoped teacher name (ADR-0020) — never a `person` row. */
export type MyPerjadinPengajar = {
  id: string;
  name: string;
};

/** One Pimpinan recorded on the trip — record-only, the name of a real Pimpinan-Person (#181). */
export type MyPerjadinPimpinan = {
  personId: string;
  name: string;
};

/** One offline Session at a visited School, and how it is going. Cancelled ones are included. */
export type MyPerjadinSession = {
  sessionId: string;
  heldOn: string;
  /** Wall-clock start time local to the School (`HH:MM:SS`), read beside its School's `timeZone`. */
  startsAt: string;
  status: SessionStatus;
};

/** One visited School, with the trip's offline Sessions there. */
export type MyPerjadinSchool = {
  schoolId: string;
  name: string;
  kabupatenKota: string;
  /** The School's Province's Time Zone, for rendering each Session's `startsAt`. */
  timeZone: TimeZone;
  sessions: MyPerjadinSession[];
};

/**
 * One trip the caller is on, everything its `/pendamping` card renders.
 *
 * `preparation` is the flat fixed six (amendment to ADR-0018), each item carrying its tick state —
 * the same `derivePreparationChecklist` the detail read runs. It carries the whole checklist rather
 * than a bare `x`/`N` because the card's pill *and* its Persiapan dialog read from one payload: the
 * pill is `preparation.filter(i => i.checked).length` out of `preparation.length` (always six), and
 * the dialog toggles the very items shown here.
 */
export type MyPerjadinTrip = {
  id: string;
  destination: string;
  startsOn: string;
  endsOn: string;
  picPersonId: string;
  picFullName: string;
  /**
   * The Perjadin Report's state, for the line the card shows **only when the caller is the PIC**
   * (`report.callerIsPic`). `dueOn` is the acquittal's own deadline (`perjadinReportDeadline`), and
   * `overdue` compares it with today in the office's zone, as `daysRemaining` does there. `filedOn`
   * is the WIB calendar day the Report was filed, null until then.
   */
  report: { callerIsPic: boolean; dueOn: string; overdue: boolean; filedOn: string | null };
  /** Fixed at planning and transferred before departure, so never null and never absent. */
  advanceIdr: number;
  /**
   * The **travel-float draw-down** for this trip: the sum of only the transactions whose category is
   * an `ADVANCE_DRAWDOWN_CATEGORIES` member (ADR-0029), zero when none has been entered. The UI
   * derives Tersisa as `advanceIdr - drawnDownIdr`, the same math `perjadinAcquittal.remainderIdr`
   * uses — a test pins the two equal so the two screens never show two answers. It is summed in SQL
   * here (this list renders no line items) with a `category in (…)` filter kept in step with the
   * domain constant, where the acquittal reduces its loaded rows through `sumAdvanceDrawdownIdr`.
   */
  drawnDownIdr: number;
  /** The fixed six, each with its current tick state — the pill's `x`/`N` and the dialog's boxes. */
  preparation: PreparationItem[];
  /**
   * Who is on the trip, in three lists the way `docs/data-model.md` splits them: the Staff Group,
   * the trip-scoped teacher names, and the record-only Pimpinan. `anggotaTotal` is their combined
   * head count, summed here so the strip does not re-add three lengths at the render site.
   */
  anggota: {
    staff: MyPerjadinStaff[];
    pengajar: MyPerjadinPengajar[];
    pimpinan: MyPerjadinPimpinan[];
    anggotaTotal: number;
  };
  /** The Schools this trip teaches at, each with its offline Sessions (cancelled ones included). */
  schools: MyPerjadinSchool[];
};

/** The caller's trips, split at today: `current` soonest first, `previous` most recent first. */
export type MyPerjadin = { current: MyPerjadinTrip[]; previous: MyPerjadinTrip[] };

/**
 * **The caller's own trips, in one read**, split at today in the office's zone: a trip ending today
 * is still current.
 *
 * Shaped like `perjadinAcquittal`/`perjadinDetail`: the base trip rows come back first — filtered to
 * the caller's memberships and sorted for a total order — then each hanging list is one batched
 * select keyed by `inArray(tripIds)` and stitched on with a Map, rather than one join that would
 * multiply each list by the others'. When the caller is on no trip the base query returns nothing
 * and the extra round trips are skipped entirely.
 */
export async function myPerjadin(caller: Person): Promise<MyPerjadin> {
  // Not yet over: `ends_on` on or after today, reckoned in the office's zone via the shared
  // `todayInDeadlineZone` fragment (`./deadline.ts`) — the same calendar the acquittal's
  // `daysRemaining` counts in, not the database session's default zone.
  const isCurrent = sql<boolean>`${perjadin.endsOn} >= ${todayInDeadlineZone}`;

  // The base rows: every trip the caller is a `group_member` of. The `group_member` inner join both
  // filters (only the caller's trips) and cannot fan out — its primary key is
  // `(perjadin_id, person_id)`, so at most one row matches for a given caller.
  const rows = await db
    .select({
      id: perjadin.id,
      destination: perjadin.destination,
      startsOn: perjadin.startsOn,
      endsOn: perjadin.endsOn,
      picPersonId: perjadin.picPersonId,
      picFullName: person.fullName,
      advanceIdr: perjadin.advanceIdr,
      isCurrent,
      reportDueOn: sql<string>`to_char(${perjadinReportDeadline}, 'YYYY-MM-DD')`,
      reportOverdue: sql<boolean>`${perjadinReportDeadline} < ${todayInDeadlineZone}`,
      reportFiledOn: sql<
        string | null
      >`to_char(${perjadin.reportFiledAt} at time zone ${DEADLINE_TIME_ZONE}, 'YYYY-MM-DD')`,
    })
    .from(perjadin)
    .innerJoin(
      groupMember,
      and(eq(groupMember.perjadinId, perjadin.id), eq(groupMember.personId, caller.id)),
    )
    .innerJoin(person, eq(person.id, perjadin.picPersonId))
    // Current trips first, soonest first — a trip is remembered by when it happens. Then the
    // previous ones, the most recently ended first. `id` breaks the tie so the order is total.
    .orderBy(
      desc(isCurrent),
      sql`case when ${isCurrent} then ${perjadin.startsOn} end asc`,
      sql`case when ${isCurrent} then null else ${perjadin.endsOn} end desc`,
      sql`case when ${isCurrent} then null else ${perjadin.startsOn} end desc`,
      asc(perjadin.id),
    );

  if (rows.length === 0) return { current: [], previous: [] };

  const trips = rows.map(
    ({ isCurrent: current, reportDueOn, reportOverdue, reportFiledOn, ...trip }) => ({
      ...trip,
      current,
      report: {
        callerIsPic: trip.picPersonId === caller.id,
        dueOn: reportDueOn,
        overdue: reportOverdue,
        filedOn: reportFiledOn,
      },
    }),
  );

  const tripIds = trips.map((trip) => trip.id);

  // The six hanging lists, gathered concurrently and each scoped to just these trips.
  const [drawnDownRows, staffRows, pengajarRows, pimpinanRows, sessionRows, preparationRows] =
    await Promise.all([
      // Travel-float draw-down per trip (ADR-0029): `sum(amount_idr) filter (where category in …)`
      // over only `ADVANCE_DRAWDOWN_CATEGORIES`, grouped by `perjadin_id`. A trip with no drawdown
      // spend (or none at all) is absent or sums to 0 and defaults to 0 below. The `in (…)` list is
      // built from the domain constant so it cannot drift; the acquittal reduces its loaded rows
      // through `sumAdvanceDrawdownIdr` for the identical rule, and a test pins the UI's
      // `advanceIdr - drawnDownIdr` equal to the acquittal's `remainderIdr`.
      db
        .select({
          perjadinId: transaction.perjadinId,
          drawnDownIdr:
            sql<number>`coalesce(sum(${transaction.amountIdr}) filter (where ${transaction.category} in (${advanceDrawdownCategoryList()})), 0)`.mapWith(
              Number,
            ),
        })
        .from(transaction)
        .where(inArray(transaction.perjadinId, tripIds))
        .groupBy(transaction.perjadinId),
      // The Staff Group, joined to `person` for the name, in name order. `isPic` is derived per row
      // below rather than joined, since the PIC id is already on each trip.
      db
        .select({
          perjadinId: groupMember.perjadinId,
          personId: groupMember.personId,
          fullName: person.fullName,
        })
        .from(groupMember)
        .innerJoin(person, eq(person.id, groupMember.personId))
        .where(and(inArray(groupMember.perjadinId, tripIds), eq(groupMember.role, "Staff")))
        .orderBy(asc(person.fullName)),
      // The trip-scoped teacher names (ADR-0020), in name order.
      db
        .select({
          perjadinId: perjadinTeacher.perjadinId,
          id: perjadinTeacher.id,
          name: perjadinTeacher.name,
        })
        .from(perjadinTeacher)
        .where(inArray(perjadinTeacher.perjadinId, tripIds))
        .orderBy(asc(perjadinTeacher.name)),
      // The record-only Pimpinan (#181), joined to `person` for the display name, in name order.
      db
        .select({
          perjadinId: perjadinPimpinan.perjadinId,
          personId: perjadinPimpinan.personId,
          name: person.fullName,
        })
        .from(perjadinPimpinan)
        .innerJoin(person, eq(person.id, perjadinPimpinan.personId))
        .where(inArray(perjadinPimpinan.perjadinId, tripIds))
        .orderBy(asc(person.fullName)),
      // Every offline Session on these trips, with its School and the School's Province zone.
      // Cancelled ones are **included** — this is the trip's shape, the Schools it visited, not how
      // much teaching it delivered. Ordered by School name, then within a School by (held_on,
      // starts_at, id) for a total order.
      db
        .select({
          perjadinId: session.perjadinId,
          schoolId: session.schoolId,
          schoolName: school.name,
          kabupatenKota: school.kabupatenKota,
          timeZone: province.timeZone,
          sessionId: session.id,
          heldOn: session.heldOn,
          startsAt: session.startsAt,
          status: session.status,
        })
        .from(session)
        .innerJoin(school, eq(school.id, session.schoolId))
        .innerJoin(province, eq(province.code, school.provinceCode))
        .where(and(inArray(session.perjadinId, tripIds), eq(session.mode, "offline")))
        .orderBy(asc(school.name), asc(session.heldOn), asc(session.startsAt), asc(session.id)),
      // Every fixed-item tick on these trips. Not a count like `perjadinDirectory`'s pill: the card's
      // Persiapan dialog toggles the boxes, so it needs the whole tick per item (who and when), which
      // `derivePreparationChecklist` folds into the fixed six below — the same derivation the detail
      // read runs. A `dosen:` orphan the old model left behind matches no fixed key, so it drops out.
      db
        .select({
          perjadinId: perjadinPreparationItem.perjadinId,
          itemKey: perjadinPreparationItem.itemKey,
          checkedBy: perjadinPreparationItem.checkedBy,
          checkedAt: perjadinPreparationItem.checkedAt,
        })
        .from(perjadinPreparationItem)
        .where(inArray(perjadinPreparationItem.perjadinId, tripIds)),
    ]);

  // Float draw-down keyed by trip; a trip absent from the grouped sum drew nothing down.
  const drawnDownByTrip = new Map(drawnDownRows.map((row) => [row.perjadinId, row.drawnDownIdr]));

  const staffByTrip = new Map<string, MyPerjadinStaff[]>();
  const pengajarByTrip = new Map<string, MyPerjadinPengajar[]>();
  const pimpinanByTrip = new Map<string, MyPerjadinPimpinan[]>();
  for (const row of staffRows) {
    const list = staffByTrip.get(row.perjadinId) ?? [];
    // `isPic` off the trip's own PIC id — the row is already ordered by name, so no re-sort.
    list.push({ personId: row.personId, fullName: row.fullName, isPic: false });
    staffByTrip.set(row.perjadinId, list);
  }
  for (const row of pengajarRows) {
    const list = pengajarByTrip.get(row.perjadinId) ?? [];
    list.push({ id: row.id, name: row.name });
    pengajarByTrip.set(row.perjadinId, list);
  }
  for (const row of pimpinanRows) {
    const list = pimpinanByTrip.get(row.perjadinId) ?? [];
    list.push({ personId: row.personId, name: row.name });
    pimpinanByTrip.set(row.perjadinId, list);
  }

  // Preparation ticks bucketed by trip; `derivePreparationChecklist` folds each bucket into the
  // fixed six below. A trip absent here has no ticks, and `derivePreparationChecklist([])` gives
  // the same six all unchecked — so the pill reads `0/6` rather than the trip dropping its pill.
  const preparationTicksByTrip = new Map<string, PreparationTick[]>();
  for (const row of preparationRows) {
    const list = preparationTicksByTrip.get(row.perjadinId) ?? [];
    list.push({ itemKey: row.itemKey, checkedBy: row.checkedBy, checkedAt: row.checkedAt });
    preparationTicksByTrip.set(row.perjadinId, list);
  }

  // Sessions grouped by (trip, School), preserving the query's School-then-Session order. A trip's
  // Schools appear in first-seen order, which is School-name order since the rows are sorted so.
  const schoolsByTrip = new Map<string, MyPerjadinSchool[]>();
  const schoolByTripAndId = new Map<string, MyPerjadinSchool>();
  for (const row of sessionRows) {
    // Offline Sessions always carry a `perjadin_id` (`session_offline_iff_perjadin`), so the column
    // is non-null here; the narrowing satisfies the nullable column type.
    if (row.perjadinId === null) continue;
    const key = `${row.perjadinId}:${row.schoolId}`;
    let schoolNode = schoolByTripAndId.get(key);
    if (!schoolNode) {
      schoolNode = {
        schoolId: row.schoolId,
        name: row.schoolName,
        kabupatenKota: row.kabupatenKota,
        timeZone: row.timeZone,
        sessions: [],
      };
      schoolByTripAndId.set(key, schoolNode);
      const list = schoolsByTrip.get(row.perjadinId) ?? [];
      list.push(schoolNode);
      schoolsByTrip.set(row.perjadinId, list);
    }
    schoolNode.sessions.push({
      sessionId: row.sessionId,
      heldOn: row.heldOn,
      startsAt: row.startsAt,
      status: row.status,
    });
  }

  const built = trips.map(({ current, ...trip }) => {
    const staff = (staffByTrip.get(trip.id) ?? []).map((member) => ({
      ...member,
      isPic: member.personId === trip.picPersonId,
    }));
    const pengajar = pengajarByTrip.get(trip.id) ?? [];
    const pimpinan = pimpinanByTrip.get(trip.id) ?? [];
    return {
      ...trip,
      drawnDownIdr: drawnDownByTrip.get(trip.id) ?? 0,
      preparation: derivePreparationChecklist(preparationTicksByTrip.get(trip.id) ?? []),
      anggota: {
        staff,
        pengajar,
        pimpinan,
        anggotaTotal: staff.length + pengajar.length + pimpinan.length,
      },
      schools: schoolsByTrip.get(trip.id) ?? [],
      current,
    };
  });

  // The rows are already in section order, so splitting keeps each section's order.
  return {
    current: built.filter((trip) => trip.current).map(({ current: _, ...trip }) => trip),
    previous: built.filter((trip) => !trip.current).map(({ current: _, ...trip }) => trip),
  };
}
