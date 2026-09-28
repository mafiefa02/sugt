import {
  ONLINE_SESSION_DEFAULT_SORT,
  sortOnlineSessionDirectory,
  type SortableOnlineSession,
} from "-/components/online-session-directory-sort";
import { describe, expect, it } from "vitest";

/**
 * **The `/sesi-daring` table's one sortable column** (#344). Only Tanggal sorts; Sessions on the same
 * date follow their start time **in the same direction**, then id — so flipping Tanggal flips the whole
 * order rather than only the dates.
 */

const row = (id: string, heldOn: string, startsAt: string): SortableOnlineSession => ({
  id,
  heldOn,
  startsAt,
});

const ids = (rows: SortableOnlineSession[]) => rows.map((entry) => entry.id);

const rows = [
  row("a", "2026-09-10", "09:00:00"),
  row("b", "2026-09-12", "08:00:00"),
  row("c", "2026-09-12", "13:00:00"),
  row("d", "2026-09-12", "13:00:00"),
];

describe("sortOnlineSessionDirectory", () => {
  it("defaults to Tanggal, newest first, same-day Sessions latest start first, then id", () => {
    expect(ids(sortOnlineSessionDirectory(rows, ONLINE_SESSION_DEFAULT_SORT))).toEqual([
      "d",
      "c",
      "b",
      "a",
    ]);
  });

  it("flips the whole order when Tanggal is ascending — start time and id follow it", () => {
    expect(ids(sortOnlineSessionDirectory(rows, { key: "heldOn", direction: "asc" }))).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("does not reorder the array it was given", () => {
    sortOnlineSessionDirectory(rows, ONLINE_SESSION_DEFAULT_SORT);
    expect(ids(rows)).toEqual(["a", "b", "c", "d"]);
  });
});
