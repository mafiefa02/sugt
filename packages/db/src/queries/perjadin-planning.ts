import type { Stream, TimeZone, TransportMode } from "@sugt/domain";
import { asc, eq, inArray } from "drizzle-orm";

import { db } from "../client";
import { session } from "../schema/delivery";
import { cluster, province, school, subCluster } from "../schema/reference";
import { groupMember, perjadin } from "../schema/travel";
import type { Person } from "./caller";
import {
  duplicatedStaff,
  duplicatedTeachers,
  streamsUncovered,
  type PlannedTeacher,
} from "./group-rules";
import { activeRosters, type RosterPerson, type SelectedSchool } from "./rosters";
import { heldOnWithinPerjadin } from "./session-detail";
import { requireStaff } from "./staff-only";

/**
 * **Rencanakan Perjadin** — the form that plans a trip, and the write that brings the
 * Perjadin, its Group and one Session per School into existence together.
 *
 * Staff-only, by the surface list and by ADR-0004 alike: this one writes the Advance, so
 * both of `./staff-only.ts`'s two reasons apply rather than only the second.
 *
 * **Planning starts from a Sub-Cluster**, not from a Coverage selection
 * ([#69](https://github.com/mafiefa02/sugt/issues/69)). The screen picks a Sub-Cluster and
 * reveals its Schools — all eligible, each droppable — and asks for a date **and a time** per
 * kept School. The Sub-Cluster says which Schools may appear on the trip at all; the plan says
 * which are visited this time (`docs/product.md`, the Perjadin section).
 */

export type { PlannedTeacher };

/** One School on the trip, and the day and time the Group teaches there. */
export type PlannedSession = {
  schoolId: string;
  /** `YYYY-MM-DD`, and inside the trip's window — see the refusal below. */
  heldOn: string;
  /**
   * Local wall-clock start time (`HH:MM`), in the School's Time Zone. The form supplies one per
   * School ([#69](https://github.com/mafiefa02/sugt/issues/69)); `session.starts_at` is NOT
   * NULL, so a value is always written. Two Schools may share a date, but not a date **and** a
   * time — see the `session-time-clash` refusal.
   */
  startsAt: string;
};

/**
 * A whole trip, submitted at once.
 *
 * **The Group travels as one value and not as a series of additions**, which is what lets
 * "at least one Teaching Team member per Stream" be checked at all: it is a count across
 * sibling rows, no CHECK can see them, and ADR-0005's amendment records that this is why
 * it is validated where the Group is submitted whole.
 *
 * The PIC is **not** in `teachers`. They are Staff, they carry no Stream, and their
 * membership row is written for them — leaving it to the caller would make the deferred
 * foreign key below a thing a form could forget.
 *
 * **`subClusterId` is the trip's, picked in the form.** Every School on the trip must belong
 * to it — the rule ADR-0016 explains cannot be a foreign key, checked below at the one place
 * it can be violated. `destination` is **not** here: it is derived server-side from the
 * Sub-Cluster and its Schools' Kabupaten/Kota at insert ([#105](https://github.com/mafiefa02/sugt/issues/105)),
 * so the form has no Tujuan box to drift from what it already shows.
 */
/**
 * One leg of the trip's travel, as the form submits it: a wall-clock date and time and a mode.
 * The zone is not here — `departure_zone` is fixed to WIB (the origin is Bandung) and
 * `return_zone` is derived from the last School visited, both server-side (#106).
 */
export type PlannedTravelLeg = {
  /** `YYYY-MM-DD`. */
  date: string;
  /** `HH:MM`, wall-clock in the leg's zone. */
  time: string;
  mode: TransportMode;
};

export type PlanPerjadinInput = {
  subClusterId: string;
  startsOn: string;
  endsOn: string;
  advanceIdr: number;
  /** A Staff member. `perjadin_pic_is_staff` refuses anyone else, at the database. */
  picPersonId: string;
  /**
   * Up to three optional extra Staff on the Group, beyond the PIC — a coordinator, a treasurer, a
   * documentarian. Each must be a distinct Staff member, none equal to the PIC; they are written
   * as ordinary `group_member` rows (Staff, no Stream) and neither satisfy nor weaken the
   * Stream-cover rule.
   */
  extraStaffPersonIds?: string[];
  teachers: PlannedTeacher[];
  sessions: PlannedSession[];
  /** Departure from Bandung. Its zone is always WIB. */
  departure: PlannedTravelLeg;
  /** Return. Its zone is derived from the last School visited. */
  return: PlannedTravelLeg;
};

/** Two Schools planned for the same date and the same time — physically impossible on one trip. */
export type SessionTimeClash = {
  heldOn: string;
  startsAt: string;
  schoolIds: string[];
};

/**
 * Why a trip was not planned.
 *
 * Every one is a **user state and comes back as a value**, by the rule settled on
 * [#12](https://github.com/mafiefa02/sugt/issues/12): each is reachable from a form
 * somebody filled in honestly, and each gets a field-level message rather than an error
 * page. `NotStaffError` is the opposite case and still throws, as does a PIC who is not
 * Staff — that one is not reachable from a screen that only offers Staff.
 */
export type PlanPerjadinResult =
  | { outcome: "planned"; perjadinId: string }
  /** No professor covers a Stream. The Group rule, checked against the whole payload. */
  | { outcome: "stream-uncovered"; missing: Stream[] }
  | { outcome: "ends-before-starts" }
  /** One professor named on both Streams. A Group holds each person once, by primary key. */
  | { outcome: "duplicate-teacher"; personIds: string[] }
  /**
   * An extra Staff member repeated, or the same as the PIC. A Group holds each person once by
   * `(perjadin_id, person_id)`, so this is refused up front rather than left to a PK violation
   * inside the transaction.
   */
  | { outcome: "duplicate-staff"; personIds: string[] }
  /** A trip with no School on it teaches nobody, and would write no Session. */
  | { outcome: "no-schools" }
  /** A Session dated outside the trip it happens on. */
  | {
      outcome: "session-outside-perjadin";
      startsOn: string;
      endsOn: string;
      offending: PlannedSession[];
    }
  /**
   * A School on the trip that does not belong to the chosen Sub-Cluster. Not reachable through
   * the form, and checked anyway — ADR-0016's rule that a mutable grouping cannot be a foreign
   * key into immutable history, and planning is the one write that can violate it.
   */
  | { outcome: "school-outside-sub-cluster"; offending: string[] }
  /**
   * Two Schools sharing a date **and** a time. The Group is in one place at a time, so this is
   * impossible; `session_one_school_at_a_time_per_perjadin` is the database's backstop, but a
   * named pair up front beats a constraint violation surfacing from inside the transaction.
   */
  | { outcome: "session-time-clash"; clashes: SessionTimeClash[] };

/**
 * Plan a Perjadin: the trip, its Group and one Session per School, in one transaction.
 *
 * **Creating the Perjadin is what arranges its Sessions**, per ADR-0006 — there are no
 * planned rows waiting to be filled in, so this form is the arranging and there is no
 * second step. The three writes are one act and commit together.
 *
 * Everything the application has to check is checked **before** the transaction opens.
 * That is not an optimisation: each of these is a rule the database cannot hold, so
 * finding out inside the transaction would mean rolling back a trip somebody typed rather
 * than telling them which field is wrong.
 *
 * What is **not** checked here is checked at the database and left there. The PIC being
 * Staff is `perjadin_pic_is_staff`; a Session being offline and carrying its Perjadin is
 * `session_offline_iff_perjadin`; the PIC being on their own Group is
 * `perjadin_pic_is_a_group_member`, `DEFERRABLE INITIALLY DEFERRED` so that it is checked
 * at COMMIT — neither the Perjadin nor its membership row can go first, and this
 * transaction is the reason that constraint has the form it does.
 *
 * **No `session_teacher` rows are written.** The Group is the plan and Tandai terlaksana
 * pre-fills from it; a Group is replaced wholesale, so rows copied out of it now would be
 * stranded by a substitution, silently, with no constraint to catch it.
 */
export async function planPerjadin(
  caller: Person,
  input: PlanPerjadinInput,
): Promise<PlanPerjadinResult> {
  requireStaff(caller);

  // `perjadin_dates_check` holds this too. It is repeated here so the form can say which
  // field is wrong, rather than showing the page a constraint violation produces.
  if (input.endsOn < input.startsOn) return { outcome: "ends-before-starts" };

  if (input.sessions.length === 0) return { outcome: "no-schools" };

  const missing = streamsUncovered(input.teachers);
  if (missing.length > 0) return { outcome: "stream-uncovered", missing };

  const duplicated = duplicatedTeachers(input.teachers);
  if (duplicated.length > 0) return { outcome: "duplicate-teacher", personIds: duplicated };

  // Extra Staff must be distinct from each other and from the PIC — the Group primary key
  // `(perjadin_id, person_id)` holds each person once, so a repeat is a plan to question rather
  // than a row to write. Refused up front, not left to a PK violation inside the transaction.
  const extraStaff = input.extraStaffPersonIds ?? [];
  const duplicateStaff = duplicatedStaff(input.picPersonId, extraStaff);
  if (duplicateStaff.length > 0) return { outcome: "duplicate-staff", personIds: duplicateStaff };

  // The second of the three places a Session's date is written, and the invariant
  // [#28](https://github.com/mafiefa02/sugt/issues/28) stated: an arranged offline Session
  // lies inside its Perjadin. No CHECK can carry it, because the range is on this row and
  // the date is on another table's.
  const window = { startsOn: input.startsOn, endsOn: input.endsOn };
  const offending = input.sessions.filter(
    (planned) => !heldOnWithinPerjadin(planned.heldOn, window),
  );
  if (offending.length > 0) {
    return { outcome: "session-outside-perjadin", ...window, offending };
  }

  // A Perjadin goes to exactly one Sub-Cluster and every School it teaches at belongs to it
  // (CONTEXT.md, ADR-0016). This is the one write that can break that rule — there is no write
  // that adds a School to an existing trip — so it is refused for the whole payload here rather
  // than left to a foreign key that editability forbids. A School id that names no row, or one
  // whose Sub-Cluster is null, is "outside" too, since neither equals the chosen Sub-Cluster.
  const schoolIds = input.sessions.map((planned) => planned.schoolId);
  const memberships = await db
    .select({ id: school.id, subClusterId: school.subClusterId })
    .from(school)
    .where(inArray(school.id, schoolIds));
  const subClusterById = new Map(memberships.map((row) => [row.id, row.subClusterId]));
  const outside = [...new Set(schoolIds)].filter(
    (id) => subClusterById.get(id) !== input.subClusterId,
  );
  if (outside.length > 0) return { outcome: "school-outside-sub-cluster", offending: outside };

  // Two Schools on the same date and the same time is the Group being in two places at once —
  // `session_one_school_at_a_time_per_perjadin` refuses it, but a named pair up front is a
  // better message than a constraint violation from inside the transaction. Sharing a date
  // alone stays legal: that is exactly what the per-School start time exists to serve.
  const slots = new Map<string, SessionTimeClash>();
  for (const planned of input.sessions) {
    const key = `${planned.heldOn} ${planned.startsAt}`;
    const slot = slots.get(key) ?? {
      heldOn: planned.heldOn,
      startsAt: planned.startsAt,
      schoolIds: [],
    };
    slot.schoolIds.push(planned.schoolId);
    slots.set(key, slot);
  }
  const clashes = [...slots.values()].filter((slot) => slot.schoolIds.length > 1);
  if (clashes.length > 0) return { outcome: "session-time-clash", clashes };

  // The destination is derived, not typed: the planner has already picked the Sub-Cluster and
  // seen its Schools, so a free-text box would only restate that and could drift from it (#105).
  // A **snapshot** into the write-once column, computed once here and never on read — Sub-Clusters
  // are editable (ADR-0016), so a live read would silently rewrite an already-issued Surat Tugas
  // when Schools are later regrouped or the Sub-Cluster is renamed.
  const destination = await derivePerjadinDestination(input.subClusterId);

  // The return zone is the last-visited School's — the Group returns from that city, so its
  // wall-clock time means that city's zone, not Bandung's. Snapshot at insert, like the
  // destination, for the same ADR-0016 reason. Departure is always WIB (the origin is Bandung).
  const returnZone = await deriveReturnZone(input.sessions);

  const perjadinId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(perjadin)
      .values({
        subClusterId: input.subClusterId,
        destination,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        advanceIdr: input.advanceIdr,
        picPersonId: input.picPersonId,
        departureAt: `${input.departure.date} ${input.departure.time}`,
        departureZone: "WIB",
        departureMode: input.departure.mode,
        returnAt: `${input.return.date} ${input.return.time}`,
        returnZone,
        returnMode: input.return.mode,
      })
      .returning({ id: perjadin.id });

    const id = created!.id;

    // The PIC's own row first in the list rather than as a separate statement: they are a
    // Group member like any other, and the only thing that distinguishes them here is that
    // Staff carry no Stream — `group_member_stream_iff_teaching` refuses one that does. The
    // extra Staff are the same row shape, sitting between the PIC and the professors.
    await tx.insert(groupMember).values([
      { perjadinId: id, personId: input.picPersonId, role: "Staff" as const, stream: null },
      ...extraStaff.map((personId) => ({
        perjadinId: id,
        personId,
        role: "Staff" as const,
        stream: null,
      })),
      ...input.teachers.map((teacher) => ({
        perjadinId: id,
        personId: teacher.personId,
        role: "Teaching Team" as const,
        stream: teacher.stream,
      })),
    ]);

    await tx.insert(session).values(
      input.sessions.map((planned) => ({
        schoolId: planned.schoolId,
        perjadinId: id,
        mode: "offline" as const,
        heldOn: planned.heldOn,
        startsAt: planned.startsAt,
      })),
    );

    return id;
  });

  return { outcome: "planned", perjadinId };
}

/**
 * The destination line the Surat Tugas is written against: the Sub-Cluster's own label, then the
 * distinct Kabupaten/Kota its Schools sit in — e.g. `Kelompok 18: Samarinda, Bontang dan Balikpapan`.
 *
 * **The whole Sub-Cluster, not only the visited Schools:** the line names where the trip's
 * Kelompok is, which does not change because one School was dropped this time. Distinct
 * Kabupaten/Kota in School order (first appearance wins), so several Schools in one regency
 * collapse to one entry. The Sub-Cluster name is used verbatim — it already reads "Kelompok 18".
 */
async function derivePerjadinDestination(subClusterId: string): Promise<string> {
  const rows = await db
    .select({ name: subCluster.name, kabupatenKota: school.kabupatenKota })
    .from(subCluster)
    .innerJoin(school, eq(school.subClusterId, subCluster.id))
    .where(eq(subCluster.id, subClusterId))
    .orderBy(asc(school.name));

  const places: string[] = [];
  for (const row of rows) {
    if (!places.includes(row.kabupatenKota)) places.push(row.kabupatenKota);
  }
  return `${rows[0]?.name ?? ""}: ${joinWithDan(places)}`;
}

/**
 * Join a list the way an Indonesian sentence does: comma-separated, with `" dan "` before the
 * last and no serial comma. One item is itself; none is the empty string.
 * `["Samarinda", "Bontang", "Balikpapan"]` → `"Samarinda, Bontang dan Balikpapan"`.
 */
function joinWithDan(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} dan ${items[items.length - 1]}`;
}

/**
 * The Time Zone of the **last School visited** — the Session with the greatest `(held_on,
 * starts_at)`. The Group returns from that School's city, so `return_at`'s wall-clock time is
 * meaningful only in that Province's zone, which is why the return zone is not fixed to Bandung's.
 *
 * `sessions` is non-empty here (the `no-schools` refusal ran first) and each `schoolId` is real
 * and in the Sub-Cluster (the `school-outside-sub-cluster` refusal ran too), so the join returns a
 * row.
 */
async function deriveReturnZone(sessions: PlannedSession[]): Promise<TimeZone> {
  const last = [...sessions].sort((a, b) => {
    const byDate = b.heldOn.localeCompare(a.heldOn);
    return byDate !== 0 ? byDate : b.startsAt.localeCompare(a.startsAt);
  })[0]!;

  const [row] = await db
    .select({ timeZone: province.timeZone })
    .from(school)
    .innerJoin(province, eq(province.code, school.provinceCode))
    .where(eq(school.id, last.schoolId));
  return row!.timeZone;
}

/**
 * A School the form is planning a Session for, as one row of its Sub-Cluster shows it. The same
 * three fields a form row has always rendered, so it **aliases** `SelectedSchool` rather than
 * restating the shape — the reuse `arrange-online-session.ts`'s `SchoolOption` also makes, which
 * keeps the two from drifting.
 */
export type PlannableSchool = SelectedSchool;

/** One Sub-Cluster the form can plan a trip around, with the Schools it is eligible to visit. */
export type PlannableSubCluster = {
  id: string;
  name: string;
  /** The Cluster it sits in, so two Sub-Clusters with similar names are told apart in the picker. */
  clusterName: string;
  schools: PlannableSchool[];
};

/** Somebody the form's pickers can name. */
export type PlannablePerson = RosterPerson;

/** What Rencanakan Perjadin renders before anything is written. */
export type PerjadinPlan = {
  /** Every Sub-Cluster that has at least one School — an empty one cannot host a trip. */
  subClusters: PlannableSubCluster[];
  /** Staff, for the PIC. */
  staff: PlannablePerson[];
  /** Teaching Team, for the Group. */
  teachingTeam: PlannablePerson[];
};

/**
 * The Sub-Clusters a trip can be planned around, each with its eligible Schools, in one round
 * trip. An inner join to `school`, so a Sub-Cluster with no Schools does not appear — it has
 * nothing to visit, and the form's first act is to reveal a Sub-Cluster's Schools.
 */
async function plannableSubClusters(): Promise<PlannableSubCluster[]> {
  const rows = await db
    .select({
      subClusterId: subCluster.id,
      subClusterName: subCluster.name,
      clusterName: cluster.name,
      schoolId: school.id,
      schoolName: school.name,
      kabupatenKota: school.kabupatenKota,
    })
    .from(subCluster)
    .innerJoin(cluster, eq(cluster.id, subCluster.clusterId))
    .innerJoin(school, eq(school.subClusterId, subCluster.id))
    .orderBy(asc(cluster.name), asc(subCluster.name), asc(school.name));

  const map = new Map<string, PlannableSubCluster>();
  for (const row of rows) {
    let entry = map.get(row.subClusterId);
    if (!entry) {
      entry = {
        id: row.subClusterId,
        name: row.subClusterName,
        clusterName: row.clusterName,
        schools: [],
      };
      map.set(row.subClusterId, entry);
    }
    entry.schools.push({
      id: row.schoolId,
      name: row.schoolName,
      kabupatenKota: row.kabupatenKota,
    });
  }
  return [...map.values()];
}

/**
 * The form's payload: the Sub-Clusters to plan around, and the two rosters its pickers name.
 *
 * **Staff-only, so the read is too** — a Teaching Team member reaching the URL directly would
 * otherwise be shown the whole form and refused only on submit. `Promise.all` keeps the
 * Sub-Cluster read and the roster read concurrent; the rosters come from `./rosters.ts`, of
 * which this is the second caller — the second is what earns the shared helper.
 */
export async function perjadinPlan(caller: Person): Promise<PerjadinPlan> {
  requireStaff(caller);

  const [subClusters, rosters] = await Promise.all([plannableSubClusters(), activeRosters()]);

  return { subClusters, ...rosters };
}
