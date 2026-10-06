import { desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "../client";
import { session } from "../schema/delivery";
import { person } from "../schema/people";
import { subCluster } from "../schema/reference";
import { groupMember, perjadin, perjadinPreparationItem, perjadinTeacher } from "../schema/travel";
import type { Person } from "./caller";
import { tripSchoolNames } from "./perjadin-naming";
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
  /** The trip is named `{subClusterName} · {dates}` (ADR-0044), read live — never stored. */
  subClusterName: string;
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
   * The two name axes the `/perjadin` search matches on beyond the Sub-Cluster name, the School
   * names and `picFullName` (#334) — the trip-scoped Teaching-Team names and the Group (Kelompok
   * Perjalanan) member names. Both are one-to-many, so each is returned as an array and populated by
   * a correlated aggregate subquery rather than a join (see `pengajarNames` below). Search-only:
   * nothing on the list renders them, so a trip with none carries an empty array.
   */
  pengajarNames: string[];
  groupMemberNames: string[];
  /**
   * **The trip's Schools** (ADR-0044) — `tripSchoolNames`, the one definition: the Schools with a
   * non-cancelled Session, by name. The list shows them as the School line under the name, and the
   * search matches them.
   */
  schoolNames: string[];
};

/**
 * The two name arrays the `/perjadin` search reads (#334), each a **correlated aggregate
 * subquery**, so it stays a scalar and never fans the row out — a plain join would multiply the
 * trip row by its names. `coalesce(…, '{}'::text[])` makes a trip with none an empty array rather
 * than `null`, mirroring `roster.ts`'s `grantsHeld`. Ordered by name so the arrays are stable read
 * to read.
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

/**
 * The Terlaksana counts (#343), each a **correlated scalar subquery**, as the ticket asked, so neither
 * depends on the outer query's joins. Cancelled Sessions count toward neither. `schoolCount` is
 * the length of the trip's Schools (`tripSchoolNames`), counted after the read.
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
      subClusterName: subCluster.name,
      startsOn: perjadin.startsOn,
      endsOn: perjadin.endsOn,
      picFullName: person.fullName,
      sessionsDelivered,
      sessionsTotal,
      pengajarNames,
      groupMemberNames,
      schoolNames: tripSchoolNames(perjadin.id),
    })
    .from(perjadin)
    .innerJoin(subCluster, eq(subCluster.id, perjadin.subClusterId))
    .innerJoin(person, eq(person.id, perjadin.picPersonId))
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
      // Counted off the trip's Schools (#343, ADR-0044) — one definition for the count, the School
      // line and the search, so the three cannot disagree. A School whose every Session here was
      // cancelled is no longer visited, and counts toward none of them.
      schoolCount: trip.schoolNames.length,
      preparation,
      preparationDone: preparation.filter((item) => item.checked).length,
      preparationTotal: preparation.length,
    };
  });
}
