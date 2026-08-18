import { groupConcernsByAuthor } from "-/lib/concerns-grouping";
import type { Concern, ConcernSource } from "@sugt/db/queries";
import { describe, expect, it } from "vitest";

/**
 * `groupConcernsByAuthor` is pure presentation logic: the `/concerns` query returns the whole set
 * newest-first, and this groups it by `(source, who)` for display. The load-bearing rules are that
 * a typed Participant name never merges with a same-named professor, and that both the group order
 * and the within-group order stay newest-first — which the function gets from the input already
 * being newest-first, not by reading `at`.
 */

function concern(over: Partial<Concern> & { source: ConcernSource; who: string }): Concern {
  return {
    subject: "SMAN 1 Bandung · Student",
    aspect: "instructor",
    rating: 3,
    said: null,
    at: new Date("2026-08-01T00:00:00Z"),
    sessionId: "session-1",
    perjadinId: null,
    ...over,
  };
}

describe("groupConcernsByAuthor", () => {
  it("keeps a Participant and a professor with the same name in separate groups", () => {
    const groups = groupConcernsByAuthor([
      concern({ source: "participant", who: "Budi" }),
      concern({ source: "class-record", who: "Budi" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.source)).toEqual(["participant", "class-record"]);
    expect(groups.every((group) => group.who === "Budi")).toBe(true);
  });

  it("groups an author's concerns together, newest group first and newest-first within", () => {
    // Input is newest-first, as the query returns it: Rina's instructor concern is the most recent.
    const groups = groupConcernsByAuthor([
      concern({ source: "participant", who: "Rina", aspect: "instructor" }),
      concern({ source: "participant", who: "Sari", aspect: "materials" }),
      concern({ source: "participant", who: "Rina", aspect: "relevance" }),
    ]);

    expect(groups.map((group) => group.who)).toEqual(["Rina", "Sari"]);
    expect(groups[0]?.concerns.map((c) => c.aspect)).toEqual(["instructor", "relevance"]);
    expect(groups[0]?.concerns).toHaveLength(2);
  });

  it("gives a one-concern author its own group with a count of one", () => {
    const groups = groupConcernsByAuthor([concern({ source: "perjadin-evaluation", who: "Andi" })]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.who).toBe("Andi");
    expect(groups[0]?.concerns).toHaveLength(1);
  });

  it("returns nothing for an empty list", () => {
    expect(groupConcernsByAuthor([])).toEqual([]);
  });
});
