import type { Stream } from "@sugt/domain";
import { inArray } from "drizzle-orm";

import { db } from "../client";
import { session } from "../schema/delivery";
import { school } from "../schema/reference";
import { groupMember, perjadin } from "../schema/travel";
import type { Person } from "./caller";
import { duplicatedTeachers, streamsUncovered, type PlannedTeacher } from "./group-rules";
import { activeRosters, selectedSchools, type RosterPerson, type SelectedSchool } from "./rosters";
import { heldOnWithinPerjadin } from "./session-detail";
import { requireStaff } from "./staff-only";

/**
 * **Rencanakan Perjadin** — the form that plans a trip, and the write that brings the
 * Perjadin, its Group and one Session per School into existence together.
 *
 * Staff-only, by the surface list and by ADR-0004 alike: this one writes the Advance, so
 * both of `./staff-only.ts`'s two reasons apply rather than only the second.
 *
 * **The form is deliberately dumb** — no ranking, no suggestions, no coverage data inside
 * it. `docs/product.md` is explicit that the context comes from where you started: Staff
 * select Schools on Coverage having just read the delivered counts, and the form takes the
 * selection from there.
 */

export type { PlannedTeacher };

/** One School on the trip, and the day the Group teaches there. */
export type PlannedSession = {
  schoolId: string;
  /** `YYYY-MM-DD`, and inside the trip's window — see the refusal below. */
  heldOn: string;
  /**
   * Local wall-clock start time (`HH:MM`), in the School's Time Zone. Optional here: the
   * form that supplies a time per School is [#69](https://github.com/mafiefa02/sugt/issues/69),
   * and until it lands every Session takes `DEFAULT_START_TIME`. `session.starts_at` is
   * NOT NULL, so a value is always written.
   */
  startsAt?: string;
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
    };

/**
 * The start time every planned Session takes until the form supplies one per School
 * ([#69](https://github.com/mafiefa02/sugt/issues/69)). A placeholder, not a default worth
 * keeping: `session.starts_at` is NOT NULL, so #67 needs a value to write, and #69/#72 make
 * it real. A wall-clock `HH:MM` local to the School.
 */
const DEFAULT_START_TIME = "09:00";

/**
 * The one Sub-Cluster every School on a trip belongs to, which is the trip's own. Throws
 * when the Schools name no Sub-Cluster or more than one — neither is a state an honest
 * selection reaches once the Sub-Clusters are seeded, so it is an invariant, not a user
 * error routed back to a field. `NO ACTION` on `school.sub_cluster_id` and the seed of
 * [#73](https://github.com/mafiefa02/sugt/issues/73) are what make the single-value case
 * the only one in practice.
 */
async function subClusterOfSchools(schoolIds: string[]): Promise<string> {
  const rows = await db
    .select({ subClusterId: school.subClusterId })
    .from(school)
    .where(inArray(school.id, schoolIds));

  const subClusterIds = new Set(rows.map((row) => row.subClusterId));
  const [subClusterId] = [...subClusterIds];
  if (subClusterIds.size !== 1 || subClusterId == null) {
    throw new Error(
      "A Perjadin's Schools must share one Sub-Cluster. Seed the Sub-Clusters (#73) first.",
    );
  }
  return subClusterId;
}

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

  // A Perjadin goes to exactly one Sub-Cluster and every School it teaches at belongs to
  // that Sub-Cluster (CONTEXT.md). The trip's Sub-Cluster is therefore its Schools', derived
  // here rather than picked in the form — the Sub-Cluster-first planning flow is
  // [#69](https://github.com/mafiefa02/sugt/issues/69). Until the Sub-Clusters are seeded
  // ([#73](https://github.com/mafiefa02/sugt/issues/73)) no School has one, so this throws
  // rather than inventing a value: `perjadin.sub_cluster_id` is NOT NULL and a trip whose
  // Schools disagree about their Sub-Cluster is not a state any honest selection can reach.
  const subClusterId = await subClusterOfSchools(input.sessions.map((planned) => planned.schoolId));

  const perjadinId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(perjadin)
      .values({
        subClusterId,
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
        startsAt: planned.startsAt ?? DEFAULT_START_TIME,
      })),
    );

    return id;
  });

  return { outcome: "planned", perjadinId };
}

/** A School the form is planning a Session for. */
export type PlannableSchool = SelectedSchool;

/** Somebody the form's pickers can name. */
export type PlannablePerson = RosterPerson;

/** What Rencanakan Perjadin renders before anything is written. */
export type PerjadinPlan = {
  schools: PlannableSchool[];
  /** Staff, for the PIC. */
  staff: PlannablePerson[];
  /** Teaching Team, for the Group. */
  teachingTeam: PlannablePerson[];
};

/**
 * The form's payload.
 *
 * Two statements rather than one, and the same reading of convention 3 that Jadwalkan Sesi
 * daring settled: Schools and People are unrelated aggregates with no join to assemble, so
 * the single-statement form would be a `union all` stapling them together behind a
 * placeholder column. The screen still makes one call and assembles nothing. `Promise.all`
 * keeps the two concurrent.
 *
 * Both halves come from `./rosters.ts`, which Jadwalkan Sesi daring wrote first and this
 * module is the second caller of — the second is what earns the helper.
 */
export async function perjadinPlan(caller: Person, schoolIds: string[]): Promise<PerjadinPlan> {
  requireStaff(caller);

  const [schools, rosters] = await Promise.all([selectedSchools(schoolIds), activeRosters()]);

  return { schools, ...rosters };
}
