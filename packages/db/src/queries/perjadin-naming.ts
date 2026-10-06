import { type AnyColumn, eq, type SQL, sql } from "drizzle-orm";

import type { db } from "../client";
import { session } from "../schema/delivery";
import { school, subCluster } from "../schema/reference";
import { perjadin } from "../schema/travel";

/**
 * **What a Perjadin is named from** (ADR-0044) — SQL shared by every read that names a trip, kept
 * here beneath them and unexported from `@sugt/db/queries` (convention 3). Its rule for **the trip's
 * Schools** (`isTripSchool`) lives here too, because the name's School part is built from it, and the
 * Daftar Hadir Peserta picker and its server check use the same rule (#410) rather than a copy. `tripSchoolNames` alone
 * is re-exported from the package root, for the Perjadin token resolver in `@sugt/internal`. The
 * name itself is put together in `@sugt/internal` (`perjadin-name.ts`); this module only reads its
 * parts, live: a Perjadin's name is never stored.
 */

/**
 * **Whether a School is one of the trip's Schools** (ADR-0044) — the one query-side definition of
 * the rule: it has at least one **non-cancelled** Session on the Perjadin. A School whose every
 * Session there was cancelled is no longer visited, so it drops out. `tripSchoolNames` reads its
 * names through it, and the Daftar Hadir Peserta picker and its server check filter by it (#410).
 *
 * A correlated `exists` on the **`school` table of the enclosing query**, referenced by name — so the
 * enclosing query must select from `school` unaliased. Written against `"school"` explicitly so the
 * correlation never depends on how drizzle renders a column: in a selected field of a select over
 * one table it leaves the column unqualified, and inside this subquery a bare `"id"` would silently
 * mean the Session's. The same holds for `perjadinId`: pass a bound value (`sql\`${id}::uuid\``) or
 * a column of a query that joins more than one table, never `perjadin.id` as a selected field of a
 * select over `perjadin` alone.
 */
export function isTripSchool(perjadinId: AnyColumn | SQL) {
  return sql<boolean>`exists (
    select 1 from ${session} s
    where s.school_id = ${school}.id and s.perjadin_id = ${perjadinId} and s.status <> 'cancelled'
  )`;
}

/**
 * **The trip's Schools** (ADR-0044), by name — for every read that names a Perjadin's Schools: the
 * School line under its name, its Drive folder name, its CSV name and the `/perjadin` search. The
 * distinct names of the Schools `isTripSchool` admits, ordered by name, as stored.
 *
 * A **correlated aggregate subquery** on the given `perjadin.id` column, so it stays a scalar and
 * never fans the outer row out — valid in a grouped select when that column is in the `groupBy`. Or
 * on one trip's id as a bound value, which a select from `perjadin` alone needs: there drizzle writes
 * the column unqualified, and inside the subquery a bare `"id"` is ambiguous.
 * `coalesce(…, '{}'::text[])` makes a trip with none an empty array rather than `null`.
 */
export function tripSchoolNames(perjadinId: AnyColumn | SQL) {
  return sql<string[]>`coalesce(
    (
      select array_agg(distinct ${school}.name order by ${school}.name)
      from ${school}
      where ${isTripSchool(perjadinId)}
    ),
    '{}'::text[]
  )`;
}

/**
 * A Perjadin as a screen names and links it: its id, for `/perjadin/[id]`, and the parts of its name
 * (ADR-0044) — what a refusal or a note that points at another trip carries (#408, #409).
 */
export type PerjadinNameRef = {
  id: string;
  subClusterName: string;
  startsOn: string;
  endsOn: string;
};

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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * **Whether a write changed the trip's Schools** (#407) — and so its Drive folder name. Snapshot
 * the trip's Schools now, inside the write's transaction, and hand back a check that reads them
 * again once the write is done: `true` when the two differ. The writes that add, move or cancel an
 * offline Session report it, so their callers rename the folders only when the name moved, never on
 * every Session write.
 *
 * Compared by `tripSchoolNames`, the definition the folder name is built from, so "changed" means
 * exactly "the folder name's School part changed".
 */
export async function snapshotTripSchools(
  tx: Tx,
  perjadinId: string,
): Promise<() => Promise<boolean>> {
  const read = async () => {
    const [row] = await tx
      .select({ names: tripSchoolNames(sql`${perjadinId}::uuid`) })
      .from(perjadin)
      .where(eq(perjadin.id, perjadinId));
    return (row?.names ?? []).join("\n");
  };
  const before = await read();
  return async () => (await read()) !== before;
}
