import type { Stream } from "@sugt/domain";

import { db } from "../client";
import { session } from "../schema/delivery";
import { groupMember, perjadin } from "../schema/travel";
import type { Person } from "./caller";
import { duplicatedTeachers, streamsUncovered, type PlannedTeacher } from "./group-rules";
import { activeRosters, type RosterPerson } from "./rosters";
import { heldOnWithinPerjadin } from "./session-detail";
import { requireStaff } from "./staff-only";
import { subClusterBoard, subClusterSchoolIds, type ClusterWithSubClusters } from "./sub-clusters";

/**
 * **Rencanakan Perjadin** — the form that plans a trip, and the write that brings the
 * Perjadin, its Group and one Session per kept School into existence together.
 *
 * Staff-only, by the surface list and by ADR-0004 alike: this one writes the Advance, so
 * both of `./staff-only.ts`'s two reasons apply rather than only the second.
 *
 * **The form is deliberately dumb** — no ranking, no suggestions, no coverage data inside
 * it. `docs/product.md` is explicit that it is "not a planning aid". The trip starts from a
 * **Sub-Cluster**, whose Schools it defaults to and lets the planner drop one at a time; the
 * Sub-Cluster says which Schools are eligible, the plan says which are visited this time.
 */

export type { PlannedTeacher };

/** One School kept on the trip, the day the Group teaches there, and the hour it starts. */
export type PlannedSession = {
  schoolId: string;
  /** `YYYY-MM-DD`, and inside the trip's window — see the refusal below. */
  heldOn: string;
  /**
   * Local wall-clock start time (`HH:MM`), in the School's Time Zone. Each kept School gets
   * its own, because the Group teaches across several days and morning-at-one /
   * afternoon-at-another is exactly what the start time is for — so two Schools may share a
   * date, but not a date *and* a time. `session.starts_at` is NOT NULL.
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
 */
export type PlanPerjadinInput = {
  /**
   * The Sub-Cluster the trip goes to. It decides which Schools may appear at all, and is
   * `perjadin.sub_cluster_id` — written straight through rather than derived, since the form
   * now picks it first. `destination` is separate free-text prose and is **not** derived from
   * its name (`docs/data-model.md`, Travel).
   */
  subClusterId: string;
  destination: string;
  startsOn: string;
  endsOn: string;
  advanceIdr: number;
  /** A Staff member. `perjadin_pic_is_staff` refuses anyone else, at the database. */
  picPersonId: string;
  teachers: PlannedTeacher[];
  sessions: PlannedSession[];
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
   * A School planned onto the trip that does not belong to its Sub-Cluster. The rule
   * ADR-0016 explains cannot be a foreign key, checked here because this is the one place it
   * can be violated. Not reachable through the form — its Schools all come from the picked
   * Sub-Cluster — and refused anyway, for the whole payload, by naming the offending Schools.
   */
  | { outcome: "school-outside-sub-cluster"; schoolIds: string[] }
  /**
   * Two Schools planned on the same date **and** the same time. The Group cannot be in two
   * places, and `session_one_school_at_a_time_per_perjadin` refuses it at the database — but a
   * constraint violation from inside the transaction is a worse message than a named pair, so
   * it is caught up front and the index is left as the backstop. Two Schools sharing a *date*
   * (different times) is legal and never reaches this.
   */
  | { outcome: "schools-collide"; schoolIds: string[]; heldOn: string; startsAt: string };

/**
 * The first pair of Schools planned on the same date **and** the same time, or `null` when
 * none share both. Checked against the payload alone — `planPerjadin` creates a fresh
 * Perjadin, so there are no earlier Sessions to read, and the index keys on
 * `(perjadin_id, held_on, starts_at)` with no `school_id`, so a date+time bucket holding two
 * Schools is the whole violation.
 *
 * The comparison is on the payload strings as the form emits them (`HH:MM`). The database is
 * the backstop for anything non-canonical a raw caller might send (`09:00` versus `09:00:00`,
 * which Postgres reads as one time and a string compare does not).
 */
function collidingSchools(sessions: PlannedSession[]): {
  schoolIds: string[];
  heldOn: string;
  startsAt: string;
} | null {
  const seen = new Map<string, string>();
  for (const planned of sessions) {
    const slot = `${planned.heldOn} ${planned.startsAt}`;
    const already = seen.get(slot);
    if (already !== undefined && already !== planned.schoolId) {
      return {
        schoolIds: [already, planned.schoolId],
        heldOn: planned.heldOn,
        startsAt: planned.startsAt,
      };
    }
    seen.set(slot, planned.schoolId);
  }
  return null;
}

/**
 * Plan a Perjadin: the trip, its Group and one Session per kept School, in one transaction.
 *
 * **Creating the Perjadin is what arranges its Sessions**, per ADR-0006 — there are no
 * planned rows waiting to be filled in, so this form is the arranging and there is no
 * second step. The three writes are one act and commit together.
 *
 * Everything the application has to check is checked **before** the transaction opens.
 * That is not an optimisation: each of these is a rule the database cannot hold (or a worse
 * message than the one that can), so finding out inside the transaction would mean rolling
 * back a trip somebody typed rather than telling them which field is wrong.
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

  // ADR-0016's rule that cannot be a foreign key: every School a Perjadin teaches at belongs
  // to its Sub-Cluster. Checked against the Sub-Cluster's eligible set — read from
  // `./sub-clusters.ts` rather than fetched here again — and refused for the whole payload.
  // An unknown Sub-Cluster returns an empty set, so its every School reads as outside it.
  const eligible = new Set(await subClusterSchoolIds(input.subClusterId));
  const outside = input.sessions
    .map((planned) => planned.schoolId)
    .filter((schoolId) => !eligible.has(schoolId));
  if (outside.length > 0) return { outcome: "school-outside-sub-cluster", schoolIds: outside };

  // The Group is in one place at a time. Two Schools on one date and one time is physically
  // impossible; `session_one_school_at_a_time_per_perjadin` is the backstop, and this names
  // the pair up front rather than surfacing a constraint violation from inside the write.
  const collision = collidingSchools(input.sessions);
  if (collision) return { outcome: "schools-collide", ...collision };

  const perjadinId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(perjadin)
      .values({
        subClusterId: input.subClusterId,
        destination: input.destination,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        advanceIdr: input.advanceIdr,
        picPersonId: input.picPersonId,
      })
      .returning({ id: perjadin.id });

    const id = created!.id;

    // The PIC's own row first in the list rather than as a separate statement: they are a
    // Group member like any other, and the only thing that distinguishes them here is that
    // Staff carry no Stream — `group_member_stream_iff_teaching` refuses one that does.
    await tx.insert(groupMember).values([
      { perjadinId: id, personId: input.picPersonId, role: "Staff" as const, stream: null },
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

/** Somebody the form's pickers can name. */
export type PlannablePerson = RosterPerson;

/** What Rencanakan Perjadin renders before anything is written. */
export type PerjadinPlan = {
  /**
   * Every Cluster and its Sub-Clusters, each with the Schools currently in it — the shape the
   * Kelompok Sekolah screen already reads. The form picks a Sub-Cluster from these, then
   * defaults the trip to its Schools.
   */
  clusters: ClusterWithSubClusters[];
  /** Staff, for the PIC. */
  staff: PlannablePerson[];
  /** Teaching Team, for the Group. */
  teachingTeam: PlannablePerson[];
};

/**
 * The form's payload: every Sub-Cluster to pick from, and the two rosters.
 *
 * **Reuses `subClusterBoard`** (from #68) rather than assembling its own Sub-Cluster read —
 * the second module wanting an expression is what earns the helper, the convention beside
 * `@sugt/db`, and this is that second caller. The rosters come from `./rosters.ts`, whose
 * `activeRosters` still has its two callers. The screen makes one call and assembles nothing;
 * `Promise.all` keeps the two concurrent.
 */
export async function perjadinPlan(caller: Person): Promise<PerjadinPlan> {
  requireStaff(caller);

  const [clusters, rosters] = await Promise.all([subClusterBoard(caller), activeRosters()]);

  return { clusters, ...rosters };
}
