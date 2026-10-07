import type { TableSort } from "-/components/table-sort";
import type { DirectoryPerjadin } from "@sugt/db/queries";

/**
 * **The `/perjadin` table's column comparators** (#343). The list is small and fully loaded, so it
 * sorts in the browser like it filters; a plain function so each column's rule is testable without
 * React.
 */

/**
 * The seven columns, left to right — keyed in English like the rest of the code (CONTEXT.md); the
 * headers the screen shows are Perjadin, Sekolah, Mulai, Selesai, PIC, Persiapan and
 * Terlaksana.
 */
export type PerjadinColumn =
  | "name"
  | "schools"
  | "start"
  | "end"
  | "pic"
  | "preparation"
  | "delivered";

/** Mulai, newest first — the order the list has always had. */
export const PERJADIN_DEFAULT_SORT: TableSort<PerjadinColumn> = {
  key: "start",
  direction: "desc",
};

/** The fields the comparators read — a subset of `DirectoryPerjadin`. */
export type SortablePerjadin = Pick<
  DirectoryPerjadin,
  | "id"
  | "subClusterName"
  | "schoolCount"
  | "startsOn"
  | "endsOn"
  | "picFullName"
  | "preparationDone"
  | "sessionsDelivered"
  | "sessionsTotal"
>;

/** Terlaksana's ratio; `0/0` counts as 0 rather than as NaN. */
function deliveredRatio(trip: SortablePerjadin): number {
  return trip.sessionsTotal === 0 ? 0 : trip.sessionsDelivered / trip.sessionsTotal;
}

/** Each column ascending. The direction is applied on top; ties are left to `tiebreak`. */
const ASCENDING: Record<PerjadinColumn, (a: SortablePerjadin, b: SortablePerjadin) => number> = {
  // By name — `{Sub-Cluster} · {dates}` (ADR-0044) — numeric-aware, so "Kelompok 2" sorts before
  // "Kelompok 12". The dates part compares as dates, not as the words the name spells them in, so
  // two trips of one Kelompok sort by when they leave.
  name: (a, b) =>
    a.subClusterName.localeCompare(b.subClusterName, "id", { numeric: true }) ||
    a.startsOn.localeCompare(b.startsOn) ||
    a.endsOn.localeCompare(b.endsOn),
  schools: (a, b) => a.schoolCount - b.schoolCount,
  // ISO `YYYY-MM-DD`, so the string order is the date order.
  start: (a, b) => a.startsOn.localeCompare(b.startsOn),
  end: (a, b) => a.endsOn.localeCompare(b.endsOn),
  pic: (a, b) => a.picFullName.localeCompare(b.picFullName, "id"),
  preparation: (a, b) => a.preparationDone - b.preparationDone,
  delivered: (a, b) =>
    deliveredRatio(a) - deliveredRatio(b) || a.sessionsDelivered - b.sessionsDelivered,
};

/** Ties fall back to Mulai descending, then id — whatever the chosen direction — for a total order. */
function tiebreak(a: SortablePerjadin, b: SortablePerjadin): number {
  return b.startsOn.localeCompare(a.startsOn) || b.id.localeCompare(a.id);
}

/** A sorted copy of `trips`; the array given is left as it was. */
export function sortPerjadinDirectory<T extends SortablePerjadin>(
  trips: T[],
  sort: TableSort<PerjadinColumn>,
): T[] {
  const compare = ASCENDING[sort.key];
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...trips].sort((a, b) => sign * compare(a, b) || tiebreak(a, b));
}
