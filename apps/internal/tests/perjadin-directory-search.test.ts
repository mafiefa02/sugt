import {
  matchesPerjadinSearch,
  type SearchablePerjadin,
} from "-/components/perjadin-directory-search";
import { describe, expect, it } from "vitest";

/** **The `/perjadin` search** (#334, ADR-0044): the name, the PIC, and the three name lists. */

const trip: SearchablePerjadin = {
  subClusterName: "Kelompok 10",
  startsOn: "2026-10-12",
  endsOn: "2026-10-13",
  picFullName: "Rina Nurhayati",
  pengajarNames: ["Dr. Andi"],
  groupMemberNames: ["Budi Hartono"],
  schoolNames: ["SMAN 1 Bontang", "SMAN 2 Samarinda"],
};

describe("matchesPerjadinSearch", () => {
  it("finds a trip by its Kelompok name, case-insensitively", () => {
    expect(matchesPerjadinSearch(trip, "kelompok 10")).toBe(true);
    expect(matchesPerjadinSearch(trip, "Kelompok 11")).toBe(false);
  });

  it("finds a trip by any of its Schools", () => {
    expect(matchesPerjadinSearch(trip, "samarinda")).toBe(true);
    expect(matchesPerjadinSearch(trip, "SMAN 3")).toBe(false);
  });

  it("finds a trip by its dates as the name spells them, its PIC, pengajar and Group", () => {
    expect(matchesPerjadinSearch(trip, "12–13 Okt")).toBe(true);
    expect(matchesPerjadinSearch(trip, "nurhayati")).toBe(true);
    expect(matchesPerjadinSearch(trip, "andi")).toBe(true);
    expect(matchesPerjadinSearch(trip, "hartono")).toBe(true);
  });

  it("matches every trip on a blank query", () => {
    expect(matchesPerjadinSearch(trip, "   ")).toBe(true);
  });
});
