import { desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "../client";
import { session } from "../schema/delivery";
import { person } from "../schema/people";
import { school } from "../schema/reference";
import { groupMember, perjadin, perjadinPreparationItem, perjadinTeacher } from "../schema/travel";
import type { Person } from "./caller";
import {
  derivePreparationChecklist,
  type PreparationItem,
  type PreparationTick,
} from "./preparation-checklist";

/**
 * **The Perjadin list** — every trip, open to anyone signed in.
 *
 * A separate module from the detail, the way `./school-directory.ts` is separate from
 * `./school-detail.ts`: convention 3 is one module per surface's payload, and a list and a
 * detail are two surfaces that happen to be about the same noun.
 *
 * No money here and no role check, for the reason `./perjadin-detail.ts` gives at length:
 * the Advance is `./perjadin-report.ts`'s, behind the Staff-only choke point.
 */

/** One trip, as the list shows it. */
export type DirectoryPerjadin = {
  id: string;
  destination: string;
  startsOn: string;
  endsOn: string;
  /**
   * How many Schools the Group teaches at — those with at least one **non-cancelled** Session (#343).
   * A School whose every Session on the trip was cancelled is no longer being taught there.
   */
  schoolCount: number;
  /**
   * The Terlaksana badge's `x` and `N` (#343): delivered Sessions on the trip, over its
   * **non-cancelled** Sessions. A trip with no live Session reads `0/0`.
   */
  sessionsDelivered: number;
  sessionsTotal: number;
  picFullName: string;
  /**
   * The Preparation Checklist pill's `x` and `N` ([#114](https://github.com/mafiefa02/sugt/issues/114)).
   * `preparationTotal` is the constant **6** — the flat fixed item set (amendment to ADR-0018), with
   * no per-member derivation; `preparationDone` counts the present ticks whose key is one of the
   * six fixed items. An orphan from an older model — a `dosen:` tick, or one on a ticket key
   * ADR-0041 retired — matches none, so the pill never reads past `N`.
   */
  preparationDone: number;
  preparationTotal: number;
  /**
   * The fixed six with their tick state, for the Persiapan dialog the Staff pill opens (#343) — the
   * same `derivePreparationChecklist` `myPerjadin` and the detail read run. `preparationDone`
   * and `preparationTotal` are counted off this very list, so the pill and the dialog's boxes agree.
   */
  preparation: PreparationItem[];
  /**
   * The three name axes the `/perjadin` search matches on beyond `destination` and `picFullName`
   * (#334) — the trip-scoped Teaching-Team names, the Group (Kelompok Perjalanan) member names, and
   * the names of the Schools it visits. All three are one-to-many, so each is returned as an array
   * and populated by a correlated aggregate subquery rather than a join (see `pengajarNames` below).
   * Search-only: nothing on the list renders them, so a trip with none carries an empty array.
   */
  pengajarNames: string[];
  groupMemberNames: string[];
  schoolNames: string[];
};

/**
 * The three name arrays the `/perjadin` search reads (#334), each a **correlated aggregate
 * subquery**, kept off the outer `session` left join so it
 * stays a scalar and never fans the row out. A plain join would multiply the row and break the
 * existing `count(distinct session.school_id)` and the `groupBy`; these open their own scans instead.
 * `coalesce(…, '{}'::text[])` makes a trip with none an empty array rather than `null`, mirroring
 * `roster.ts`'s `grantsHeld`. Ordered by name so the arrays are stable read to read; `schoolNames`
 * is `distinct` because a School is taught over several Sessions on one trip. Correlated on
 * `perjadin.id`, which is in the outer `groupBy`, so each is valid in the grouped select.
 */
const pengajarNames = sql<string[]>`coalesce(
  (
    select array_agg(pt.name order by pt.name)
    from ${perjadinTeacher} pt
    where pt.perjadin_id = ${perjadin.id}
  ),
  '{}'::text[]
)`;

const groupMemberNames = sql<string[]>`coalesce(
  (
    select array_agg(gp.full_name order by gp.full_name)
    from ${groupMember} gm
    join ${person} gp on gp.id = gm.person_id
    where gm.perjadin_id = ${perjadin.id}
  ),
  '{}'::text[]
)`;

const schoolNames = sql<string[]>`coalesce(
  (
    select array_agg(distinct sch.name order by sch.name)
    from ${session} s
    join ${school} sch on sch.id = s.school_id
    where s.perjadin_id = ${perjadin.id}
  ),
  '{}'::text[]
)`;

/**
 * The Terlaksana counts (#343), each a **correlated scalar subquery**, as the ticket asked, so neither
 * depends on the outer query's joins. `schoolCount` below is the exception that stays a join
 * aggregate: it already reads the outer `session` left join for its `count(distinct …)`, and adding a
 * `filter` there changes nothing else about the query. Cancelled Sessions count toward neither.
 */
const sessionsDelivered = sql<number>`(
  select count(*) from ${session} s
  where s.perjadin_id = ${perjadin.id} and s.status = 'delivered'
)`.mapWith(Number);

const sessionsTotal = sql<number>`(
  select count(*) from ${session} s
  where s.perjadin_id = ${perjadin.id} and s.status <> 'cancelled'
)`.mapWith(Number);

/**
 * Every Perjadin, newest trip first.
 *
 * Ordered by `starts_on` rather than by `created_at`: a trip is remembered by when it
 * happens, and the two differ whenever a trip is planned out of order. `id` breaks the tie
 * so the order is total.
 */
export async function perjadinDirectory(_caller: Person): Promise<DirectoryPerjadin[]> {
  const trips = await db
    .select({
      id: perjadin.id,
      destination: perjadin.destination,
      startsOn: perjadin.startsOn,
      endsOn: perjadin.endsOn,
      picFullName: person.fullName,
      // **`distinct`, and on the School rather than the Session**, so a School taught over several
      // Sessions — or a cancelled Session and the one that replaced it — counts once. **Live
      // Sessions only (#343):** a School whose every Session on this trip was cancelled is no longer
      // visited, so the `filter` drops it; `count` over the left join's null row still reads 0.
      schoolCount:
        sql<number>`count(distinct ${session.schoolId}) filter (where ${session.status} <> 'cancelled')`.mapWith(
          Number,
        ),
      sessionsDelivered,
      sessionsTotal,
      pengajarNames,
      groupMemberNames,
      schoolNames,
    })
    .from(perjadin)
    .innerJoin(person, eq(person.id, perjadin.picPersonId))
    .leftJoin(session, eq(session.perjadinId, perjadin.id))
    .groupBy(perjadin.id, person.fullName)
    .orderBy(desc(perjadin.startsOn), desc(perjadin.id));

  if (trips.length === 0) return [];

  // The checklist for the Persiapan pill and its dialog (#343): one batched read of every trip's ticks,
  // bucketed by trip and folded into the fixed six — the shape `myPerjadin` uses, rather
  // than a join that would multiply each trip row by its ticks. A trip absent here has no ticks.
  const tickRows = await db
    .select({
      perjadinId: perjadinPreparationItem.perjadinId,
      itemKey: perjadinPreparationItem.itemKey,
      checkedBy: perjadinPreparationItem.checkedBy,
      checkedAt: perjadinPreparationItem.checkedAt,
    })
    .from(perjadinPreparationItem)
    .where(
      inArray(
        perjadinPreparationItem.perjadinId,
        trips.map((trip) => trip.id),
      ),
    );
  const ticksByTrip = new Map<string, PreparationTick[]>();
  for (const { perjadinId, ...tick } of tickRows) {
    const bucket = ticksByTrip.get(perjadinId) ?? [];
    bucket.push(tick);
    ticksByTrip.set(perjadinId, bucket);
  }

  // The pill's `x/N` is counted off the same derived checklist the dialog shows — one read of the
  // ticks for both, the way `myPerjadin`'s card does it, so the pill and the boxes agree.
  // `N` is the flat fixed six (amendment to ADR-0018); an orphan `dosen:` tick matches no item.
  return trips.map((trip) => {
    const preparation = derivePreparationChecklist(ticksByTrip.get(trip.id) ?? []);
    return {
      ...trip,
      preparation,
      preparationDone: preparation.filter((item) => item.checked).length,
      preparationTotal: preparation.length,
    };
  });
}
