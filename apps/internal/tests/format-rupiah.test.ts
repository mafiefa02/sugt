import { formatRupiah } from "@sugt/domain";
import { describe, expect, it } from "vitest";

/**
 * The one money formatter. The case worth pinning is a negative amount — an overspent travel float
 * reads as a real negative remainder (ADR-0029) — where the sign belongs before `Rp`, not between
 * the prefix and the digits (#348).
 */
describe("formatRupiah", () => {
  it("prefixes Rp to the grouped digits with no space", () => {
    expect(formatRupiah(15000000000)).toBe("Rp15.000.000.000");
    expect(formatRupiah(0)).toBe("Rp0");
  });

  it("puts the sign of a negative amount before Rp", () => {
    expect(formatRupiah(-50000)).toBe("-Rp50.000");
  });
});
