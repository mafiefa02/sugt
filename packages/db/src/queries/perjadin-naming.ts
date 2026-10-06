import { type AnyColumn, sql } from "drizzle-orm";

import { session } from "../schema/delivery";
import { school, subCluster } from "../schema/reference";
import { perjadin } from "../schema/travel";

/**
 * **What a Perjadin is named from** (ADR-0044) — SQL shared by every read that names a trip, kept
 * here beneath them and unexported from `@sugt/db/queries` (convention 3). `tripSchoolNames` alone
 * is re-exported from the package root, for the Perjadin token resolver in `@sugt/internal`. The name itself is put together
 * in `@sugt/internal` (`perjadin-name.ts`); this module only reads its parts, live: a Perjadin's name
 * is never stored.
 */

/**
 * **The trip's Schools** (ADR-0044) — the one query-side definition, for every read that names a
 * Perjadin's Schools: the School line under its name, its Drive folder name, its CSV name and the
 * `/perjadin` search. The distinct Schools with at least one **non-cancelled** Session on the trip,
 * ordered by name, as stored. A School whose every Session there was cancelled is no longer visited,
 * so it drops out.
 *
 * A **correlated aggregate subquery** on the given `perjadin.id` column, so it stays a scalar and
 * never fans the outer row out — valid in a grouped select when that column is in the `groupBy`.
 * `coalesce(…, '{}'::text[])` makes a trip with none an empty array rather than `null`.
 */
export function tripSchoolNames(perjadinId: AnyColumn) {
  return sql<string[]>`coalesce(
    (
      select array_agg(distinct sch.name order by sch.name)
      from ${session} s
      join ${school} sch on sch.id = s.school_id
      where s.perjadin_id = ${perjadinId} and s.status <> 'cancelled'
    ),
    '{}'::text[]
  )`;
}

/**
 * What a Perjadin's Drive folder is named from: its id, its Sub-Cluster's name, its two dates and
 * the trip's Schools. `perjadinFolderName` in `@sugt/internal` puts them together.
 */
export type PerjadinFolderNaming = {
  id: string;
  subClusterName: string;
  startsOn: string;
  endsOn: string;
  schoolNames: string[];
};

/** The columns `PerjadinFolderNaming` is read from, for a select that joins `sub_cluster` on the trip. */
export const perjadinFolderNaming = {
  id: perjadin.id,
  subClusterName: subCluster.name,
  startsOn: perjadin.startsOn,
  endsOn: perjadin.endsOn,
  schoolNames: tripSchoolNames(perjadin.id),
};
