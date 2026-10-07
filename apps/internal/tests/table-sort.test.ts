import {
  PERJADIN_DEFAULT_SORT,
  sortPerjadinDirectory,
  type SortablePerjadin,
} from "-/components/perjadin-directory-sort";
import { progressTone } from "-/components/progress-tone";
import { ariaSort, nextTableSort } from "-/components/table-sort";
import { describe, expect, it } from "vitest";

/**
 * **The `/perjadin` table's sort** (#343), and the shared pieces `/sesi-daring` reuses (#344). Pure
 * over the fully-loaded list — no DB, no React — so the click rule (a new column sorts descending
 * first, the same column flips) and each column's comparator are pinned where they are cheap.
 */

describe("nextTableSort", () => {
  it("sorts a newly clicked column descending first", () => {
    expect(nextTableSort({ key: "a", direction: "asc" }, "b")).toEqual({
      key: "b",
      direction: "desc",
    });
  });

  it("flips the direction when the same column is clicked again", () => {
    expect(nextTableSort({ key: "a", direction: "desc" }, "a")).toEqual({
      key: "a",
      direction: "asc",
    });
    expect(nextTableSort({ key: "a", direction: "asc" }, "a")).toEqual({
      key: "a",
      direction: "desc",
    });
  });
});

describe("ariaSort", () => {
  it("names the direction on the sorted column and none elsewhere", () => {
    expect(ariaSort({ key: "a", direction: "asc" }, "a")).toBe("ascending");
    expect(ariaSort({ key: "a", direction: "desc" }, "a")).toBe("descending");
    expect(ariaSort({ key: "a", direction: "desc" }, "b")).toBe("none");
  });
});

describe("progressTone", () => {
  it("is neutral at zero, including 0/0", () => {
    expect(progressTone(0, 0)).toContain("bg-muted");
    expect(progressTone(0, 7)).toContain("bg-muted");
  });

  it("is amber part-way and emerald when complete", () => {
    expect(progressTone(3, 7)).toContain("bg-amber-100");
    expect(progressTone(7, 7)).toContain("bg-emerald-100");
  });
});

function trip(id: string, patch: Partial<SortablePerjadin> = {}): SortablePerjadin {
  return {
    id,
    subClusterName: "Kelompok 1",
    schoolCount: 1,
    startsOn: "2026-09-01",
    endsOn: "2026-09-03",
    picFullName: "Rina",
    preparationDone: 0,
    sessionsDelivered: 0,
    sessionsTotal: 0,
    ...patch,
  };
}

const ids = (rows: SortablePerjadin[]) => rows.map((row) => row.id);

describe("sortPerjadinDirectory", () => {
  it("defaults to Mulai, newest first", () => {
    const rows = [
      trip("a", { startsOn: "2026-09-01" }),
      trip("b", { startsOn: "2026-10-01" }),
      trip("c", { startsOn: "2026-08-01" }),
    ];
    expect(ids(sortPerjadinDirectory(rows, PERJADIN_DEFAULT_SORT))).toEqual(["b", "a", "c"]);
  });

  it("sorts Perjadin by name numeric-aware, so Kelompok 2 comes before Kelompok 12", () => {
    const rows = [
      trip("twelve", { subClusterName: "Kelompok 12" }),
      trip("two", { subClusterName: "Kelompok 2" }),
    ];
    expect(ids(sortPerjadinDirectory(rows, { key: "name", direction: "asc" }))).toEqual([
      "two",
      "twelve",
    ]);
    expect(ids(sortPerjadinDirectory(rows, { key: "name", direction: "desc" }))).toEqual([
      "twelve",
      "two",
    ]);
  });

  it("sorts two trips of one Kelompok by their dates, not by how the name spells them", () => {
    // "12 Okt" spelled out sorts before "9 Okt" as text; as dates it comes after.
    const rows = [
      trip("later", { startsOn: "2026-10-12", endsOn: "2026-10-13" }),
      trip("earlier", { startsOn: "2026-10-09", endsOn: "2026-10-10" }),
    ];
    expect(ids(sortPerjadinDirectory(rows, { key: "name", direction: "asc" }))).toEqual([
      "earlier",
      "later",
    ]);
  });

  it("sorts Sekolah by count, Selesai by date, PIC by name and Persiapan by done count", () => {
    const rows = [
      trip("a", { schoolCount: 3, endsOn: "2026-09-05", picFullName: "Budi", preparationDone: 1 }),
      trip("b", { schoolCount: 1, endsOn: "2026-09-09", picFullName: "Andi", preparationDone: 6 }),
    ];
    expect(ids(sortPerjadinDirectory(rows, { key: "schools", direction: "desc" }))).toEqual([
      "a",
      "b",
    ]);
    expect(ids(sortPerjadinDirectory(rows, { key: "end", direction: "desc" }))).toEqual(["b", "a"]);
    expect(ids(sortPerjadinDirectory(rows, { key: "pic", direction: "asc" }))).toEqual(["b", "a"]);
    expect(ids(sortPerjadinDirectory(rows, { key: "preparation", direction: "desc" }))).toEqual([
      "b",
      "a",
    ]);
  });

  it("sorts Terlaksana by ratio with 0/0 as 0, then by the delivered count", () => {
    const rows = [
      trip("none", { sessionsDelivered: 0, sessionsTotal: 0 }),
      trip("half-of-2", { sessionsDelivered: 1, sessionsTotal: 2 }),
      trip("half-of-4", { sessionsDelivered: 2, sessionsTotal: 4 }),
      trip("all", { sessionsDelivered: 2, sessionsTotal: 2 }),
    ];
    expect(ids(sortPerjadinDirectory(rows, { key: "delivered", direction: "desc" }))).toEqual([
      "all",
      "half-of-4",
      "half-of-2",
      "none",
    ]);
  });

  it("breaks ties by Mulai descending, then id — whatever the direction", () => {
    const rows = [
      trip("a", { schoolCount: 2, startsOn: "2026-09-01" }),
      trip("c", { schoolCount: 2, startsOn: "2026-10-01" }),
      trip("b", { schoolCount: 2, startsOn: "2026-10-01" }),
    ];
    const expected = ["c", "b", "a"];
    expect(ids(sortPerjadinDirectory(rows, { key: "schools", direction: "desc" }))).toEqual(
      expected,
    );
    expect(ids(sortPerjadinDirectory(rows, { key: "schools", direction: "asc" }))).toEqual(
      expected,
    );
  });

  it("does not reorder the array it was given", () => {
    const rows = [trip("a", { startsOn: "2026-09-01" }), trip("b", { startsOn: "2026-10-01" })];
    sortPerjadinDirectory(rows, PERJADIN_DEFAULT_SORT);
    expect(ids(rows)).toEqual(["a", "b"]);
  });
});
