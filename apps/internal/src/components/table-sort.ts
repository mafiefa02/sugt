/**
 * **The sort state behind the app's sortable tables** (#343) — `/perjadin`, and `/sesi-daring` after
 * it (#344). Plain functions rather than a hook so the click rule is testable without React, the
 * reason `acquittal-transactions-sort.ts` is one. The state itself lives in the table's `useState`,
 * not the URL.
 */

export type SortDirection = "asc" | "desc";

/** Which column the table is sorted by, and which way. `K` is the table's own column-key union. */
export type TableSort<K extends string> = { key: K; direction: SortDirection };

/**
 * The sort after a header click: a **new** column sorts descending first — the useful end of every
 * column here is the top (newest, most, furthest along) — and clicking the sorted column again flips it.
 */
export function nextTableSort<K extends string>(current: TableSort<K>, key: K): TableSort<K> {
  if (current.key !== key) return { key, direction: "desc" };
  return { key, direction: current.direction === "desc" ? "asc" : "desc" };
}

/** The `aria-sort` a column header carries: its direction when it is the sorted column, else `none`. */
export function ariaSort<K extends string>(
  current: TableSort<K>,
  key: K,
): "ascending" | "descending" | "none" {
  if (current.key !== key) return "none";
  return current.direction === "asc" ? "ascending" : "descending";
}
