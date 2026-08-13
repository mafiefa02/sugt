import { formatSessionStartTime, formatSessionStartTimeWithWib } from "@sugt/domain";
import { describe, expect, it } from "vitest";

/**
 * A Session's start time is local to the School, in the School's Time Zone. The formatter
 * is pure arithmetic on fixed offsets — WIB +7, WITA +8, WIT +9, no daylight saving
 * anywhere in Indonesia — so the one case worth pinning is the WIB equivalent crossing
 * midnight, which a naive subtraction gets wrong.
 */
describe("formatSessionStartTime", () => {
  it("renders the local time and zone, dropping seconds", () => {
    expect(formatSessionStartTime("09:00", "WIT")).toBe("09:00 WIT");
    expect(formatSessionStartTime("09:00:00", "WITA")).toBe("09:00 WITA");
    expect(formatSessionStartTime("14:30:00", "WIB")).toBe("14:30 WIB");
  });

  it("rejects a value that is not a time", () => {
    expect(() => formatSessionStartTime("9am", "WIB")).toThrow();
    expect(() => formatSessionStartTime("25:00", "WIB")).toThrow();
    expect(() => formatSessionStartTime("09:60", "WIB")).toThrow();
  });
});

describe("formatSessionStartTimeWithWib", () => {
  it("appends the WIB equivalent off the fixed offsets", () => {
    expect(formatSessionStartTimeWithWib("09:00", "WIT")).toBe("09:00 WIT · 07:00 WIB");
    expect(formatSessionStartTimeWithWib("09:00", "WITA")).toBe("09:00 WITA · 08:00 WIB");
  });

  it("shows no equivalent on WIB, where it would only repeat itself", () => {
    expect(formatSessionStartTimeWithWib("09:00", "WIB")).toBe("09:00 WIB");
  });

  it("wraps across midnight — 00:30 WIT is 22:30 WIB the day before", () => {
    expect(formatSessionStartTimeWithWib("00:30", "WIT")).toBe("00:30 WIT · 22:30 WIB");
    expect(formatSessionStartTimeWithWib("01:00", "WITA")).toBe("01:00 WITA · 00:00 WIB");
  });
});
