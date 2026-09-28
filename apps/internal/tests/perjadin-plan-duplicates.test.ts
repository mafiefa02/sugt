import { duplicateSessionRows } from "-/components/perjadin-plan-duplicates";
import { describe, expect, it } from "vitest";

/**
 * **Rencanakan Perjadin's client-side duplicate check** (#342, ADR-0038). One live Session per
 * School per date and start time: parallel rooms are one Session now, so a second row at the same
 * School and moment is flagged before submit. Pure over the form's draft state — no DB, no React —
 * so the rule is pinned where it is cheap to exercise; `planPerjadin` and the index refuse the same
 * payload server-side.
 */

const draft = (date: string, time: string) => ({ date, time });

describe("duplicateSessionRows", () => {
  it("flags the second row at one School on the same date and time, not the first", () => {
    const flagged = duplicateSessionRows({
      school1: [draft("2026-10-01", "08:00"), draft("2026-10-01", "08:00")],
    });
    expect([...flagged]).toEqual(["school1-1"]);
  });

  it("flags every repeat after the first in a slot", () => {
    const flagged = duplicateSessionRows({
      school1: [
        draft("2026-10-01", "08:00"),
        draft("2026-10-01", "10:00"),
        draft("2026-10-01", "08:00"),
        draft("2026-10-01", "08:00"),
      ],
    });
    expect([...flagged].sort()).toEqual(["school1-2", "school1-3"]);
  });

  it("does not flag the same School at a different time or on a different date", () => {
    const flagged = duplicateSessionRows({
      school1: [
        draft("2026-10-01", "08:00"),
        draft("2026-10-01", "10:00"),
        draft("2026-10-02", "08:00"),
      ],
    });
    expect(flagged.size).toBe(0);
  });

  it("does not flag two different Schools at one moment — that is the time-clash rule, not this one", () => {
    const flagged = duplicateSessionRows({
      school1: [draft("2026-10-01", "08:00")],
      school2: [draft("2026-10-01", "08:00")],
    });
    expect(flagged.size).toBe(0);
  });

  it("ignores rows whose date or time is still blank", () => {
    const flagged = duplicateSessionRows({
      school1: [draft("", ""), draft("", ""), draft("2026-10-01", ""), draft("2026-10-01", "")],
    });
    expect(flagged.size).toBe(0);
  });
});
