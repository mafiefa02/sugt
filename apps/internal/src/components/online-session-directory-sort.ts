import type { TableSort } from "-/components/table-sort";
import type { DirectoryOnlineSession } from "@sugt/db/queries";

/**
 * **The `/sesi-daring` table's sort** (#344). Only Tanggal sorts — the column key union has one
 * member — and the other headers are plain. A plain function over the fully-loaded list, like
 * `perjadin-directory-sort.ts`, so the rule is testable without React.
 */

export type OnlineSessionColumn = "heldOn";

/** Tanggal, newest first — the order the query already returns. */
export const ONLINE_SESSION_DEFAULT_SORT: TableSort<OnlineSessionColumn> = {
  key: "heldOn",
  direction: "desc",
};

/** The fields the comparator reads — a subset of `DirectoryOnlineSession`. */
export type SortableOnlineSession = Pick<DirectoryOnlineSession, "id" | "heldOn" | "startsAt">;

/**
 * A sorted copy of `sessions`, by Tanggal and then start time and then id — **all in the chosen
 * direction**, so flipping Tanggal flips the whole order and same-day Sessions follow it. `held_on`
 * is ISO `YYYY-MM-DD` and `starts_at` a zero-padded `HH:MM:SS`, so string order is time order.
 */
export function sortOnlineSessionDirectory<T extends SortableOnlineSession>(
  sessions: T[],
  sort: TableSort<OnlineSessionColumn>,
): T[] {
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...sessions].sort(
    (a, b) =>
      sign *
      (a.heldOn.localeCompare(b.heldOn) ||
        a.startsAt.localeCompare(b.startsAt) ||
        a.id.localeCompare(b.id)),
  );
}
