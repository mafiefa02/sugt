import {
  formatTripDates,
  perjadinCsvFileName,
  perjadinFolderName,
  perjadinName,
  perjadinSchoolsLine,
} from "-/lib/perjadin-name";
import { describe, expect, it } from "vitest";

/**
 * **What a Perjadin is called** (ADR-0044) — the one formatter every screen, both Drive folders and
 * the CSV export go through. Pure: no database, no Drive.
 */

const TRIP = "1a2b3c4d-0000-4000-8000-000000000001";

describe("formatTripDates", () => {
  it.each([
    ["2026-10-12", "2026-10-13", "12–13 Okt 2026"],
    ["2026-10-12", "2026-10-12", "12 Okt 2026"],
    ["2026-09-30", "2026-10-02", "30 Sep – 2 Okt 2026"],
    ["2026-12-30", "2027-01-02", "30 Des 2026 – 2 Jan 2027"],
  ])("writes %s – %s as %s", (startsOn, endsOn, dates) => {
    expect(formatTripDates(startsOn, endsOn)).toBe(dates);
  });
});

describe("perjadinName", () => {
  it.each([
    ["2026-10-12", "2026-10-13", "Kelompok 10 · 12–13 Okt 2026"],
    ["2026-10-12", "2026-10-12", "Kelompok 10 · 12 Okt 2026"],
    ["2026-09-30", "2026-10-02", "Kelompok 10 · 30 Sep – 2 Okt 2026"],
    ["2026-12-30", "2027-01-02", "Kelompok 10 · 30 Des 2026 – 2 Jan 2027"],
  ])("names a trip from %s to %s %s", (startsOn, endsOn, name) => {
    expect(perjadinName({ subClusterName: "Kelompok 10", startsOn, endsOn })).toBe(name);
  });
});

describe("perjadinSchoolsLine", () => {
  it("lists the Schools alphabetically, joined with a comma", () => {
    expect(perjadinSchoolsLine(["SMAN 2 Samarinda", "SMAN 1 Bontang"])).toBe(
      "SMAN 1 Bontang, SMAN 2 Samarinda",
    );
  });

  it("is empty for a trip with no live Session", () => {
    expect(perjadinSchoolsLine([])).toBe("");
  });
});

describe("perjadinFolderName", () => {
  const trip = {
    id: TRIP,
    subClusterName: "Kelompok 10",
    startsOn: "2026-10-12",
    endsOn: "2026-10-13",
  };

  it("carries the name, the trip's Schools and the P- id", () => {
    expect(
      perjadinFolderName({ ...trip, schoolNames: ["SMAN 2 Samarinda", "SMAN 1 Bontang"] }),
    ).toBe("Kelompok 10 · 12–13 Okt 2026 · SMAN 1 Bontang, SMAN 2 Samarinda · P-1a2b3c4d");
  });

  it("leaves the Schools out when the trip has no live Session, still ending in the P- id", () => {
    expect(perjadinFolderName({ ...trip, schoolNames: [] })).toBe(
      "Kelompok 10 · 12–13 Okt 2026 · P-1a2b3c4d",
    );
  });
});

describe("perjadinCsvFileName", () => {
  const trip = { subClusterName: "Kelompok 10", startsOn: "2026-10-12", endsOn: "2026-10-13" };

  it("is the Drive folder's rule without the id, slugified", () => {
    expect(
      perjadinCsvFileName({ ...trip, schoolNames: ["SMAN 2 Samarinda", "SMAN 1 Bontang"] }),
    ).toBe("laporan-perjadin-kelompok-10-12-13-okt-2026-sman-1-bontang-sman-2-samarinda.csv");
  });

  it("is the name alone with no live Session, and folds accents to their letter", () => {
    expect(perjadinCsvFileName({ ...trip, schoolNames: [] })).toBe(
      "laporan-perjadin-kelompok-10-12-13-okt-2026.csv",
    );
    expect(perjadinCsvFileName({ ...trip, schoolNames: ["SMA Nūr"] })).toBe(
      "laporan-perjadin-kelompok-10-12-13-okt-2026-sma-nur.csv",
    );
  });
});
