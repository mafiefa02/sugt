import { desc, eq, sql } from "drizzle-orm";

import { db } from "../client";
import { session } from "../schema/delivery";
import { person } from "../schema/people";
import { perjadin } from "../schema/travel";
import type { Person } from "./caller";
import { PREPARATION_FIXED_KEYS } from "./preparation-checklist";

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
  /** How many Schools the Group teaches at. The trip's size, in the only unit that matters. */
  schoolCount: number;
  picFullName: string;
  /**
   * The Preparation Checklist pill's `x` and `N` ([#114](https://github.com/mafiefa02/sugt/issues/114)).
   * `preparationTotal` is `6 + (Teaching Team members)`; `preparationDone` counts the present ticks
   * that still map to a live item — every fixed tick, plus each `dosen:` tick whose person is still
   * on the Group. Orphan `dosen:` ticks are excluded, so the pill never reads past `N`.
   */
  preparationDone: number;
  preparationTotal: number;
};

/**
 * Every Perjadin, newest trip first.
 *
 * Ordered by `starts_on` rather than by `created_at`: a trip is remembered by when it
 * happens, and the two differ whenever a trip is planned out of order. `id` breaks the tie
 * so the order is total.
 */
export async function perjadinDirectory(_caller: Person): Promise<DirectoryPerjadin[]> {
  return db
    .select({
      id: perjadin.id,
      destination: perjadin.destination,
      startsOn: perjadin.startsOn,
      endsOn: perjadin.endsOn,
      picFullName: person.fullName,
      // **`distinct`, and on the School rather than the Session.** Cancelled Sessions count
      // here, unlike everywhere else — this is how big the trip is, not how much teaching it
      // delivered — and both partial unique indexes are predicated on `status <> 'cancelled'`
      // precisely so a cancelled Session and the one that replaced it coexist on one trip.
      // Counting Sessions would report a two-School trip as three the first time that happens.
      schoolCount: sql<number>`count(distinct ${session.schoolId})`.mapWith(Number),
      // **The pill, as two correlated scalar subqueries.** They count against the whole `perjadin`
      // row (a grouping column here), so they stay independent of the `session` left join above and
      // never fan out the way another join would. `N` is the six fixed items plus this trip's
      // Teaching Team members; `x` counts the ticks that still map to a live item — every fixed tick,
      // and each `dosen:` tick whose person is still a Teaching Team member (an orphan is skipped, so
      // `x` never exceeds `N`). Written as raw SQL against the physical names, the same discipline the
      // migrations follow, with the fixed keys bound from the one list so they cannot drift.
      preparationTotal: sql<number>`6 + (
        select count(*) from "group_member" gm
        where gm.perjadin_id = ${perjadin.id} and gm.role = 'Teaching Team'
      )`.mapWith(Number),
      preparationDone: sql<number>`(
        select count(*) from "perjadin_preparation_item" pi
        where pi.perjadin_id = ${perjadin.id}
        and (
          pi.item_key in (${sql.join(
            PREPARATION_FIXED_KEYS.map((key) => sql`${key}`),
            sql`, `,
          )})
          or exists (
            select 1 from "group_member" gm
            where gm.perjadin_id = pi.perjadin_id
            and gm.role = 'Teaching Team'
            and pi.item_key = 'dosen:' || gm.person_id::text
          )
        )
      )`.mapWith(Number),
    })
    .from(perjadin)
    .innerJoin(person, eq(person.id, perjadin.picPersonId))
    .leftJoin(session, eq(session.perjadinId, perjadin.id))
    .groupBy(perjadin.id, person.fullName)
    .orderBy(desc(perjadin.startsOn), desc(perjadin.id));
}
