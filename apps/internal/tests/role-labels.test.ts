import { PERJADIN_ROLE_LABELS, ROLES, ROLE_LABELS } from "@sugt/domain";
import { describe, expect, it } from "vitest";

/**
 * **The role display labels, tested with no database and no DOM.**
 *
 * Like `theme-cycle.test.ts`, this file touches neither Postgres nor a browser. It pins the
 * one thing [#116](https://github.com/mafiefa02/sugt/issues/116) asks for — that the internal
 * UI shows `Staff` as **DITSAMA** — and, just as importantly, that this is *presentation only*:
 * the map's keys are the stored `ROLES` values, unchanged, so every `role === "Staff"` compare,
 * CHECK constraint and composite FK still speaks the same string it always did.
 */
describe("ROLE_LABELS", () => {
  it("labels Staff as DITSAMA and leaves Teaching Team as-is", () => {
    expect(ROLE_LABELS.Staff).toBe("DITSAMA");
    expect(ROLE_LABELS["Teaching Team"]).toBe("Teaching Team");
  });

  it("keys on the stored role values, so the domain term stays Staff", () => {
    // The stored value is what the keys are: renaming a label must never rename a role.
    expect(Object.keys(ROLE_LABELS).sort()).toEqual([...ROLES].sort());
    expect(ROLES).toContain("Staff");
  });
});

/**
 * **The Perjadin-surface role labels** (#141). The same stored role, seen from the trip's
 * vantage point: on a Perjadin the DITSAMA people who accompany the Teaching Team read as
 * **Pendamping**. Presentation only, and keyed on the stored `ROLES` values exactly like
 * `ROLE_LABELS`, so `[member.role]` render sites resolve and nothing stored changes.
 */
describe("PERJADIN_ROLE_LABELS", () => {
  it("labels Staff as Pendamping and leaves Teaching Team as-is", () => {
    expect(PERJADIN_ROLE_LABELS.Staff).toBe("Pendamping");
    expect(PERJADIN_ROLE_LABELS["Teaching Team"]).toBe("Teaching Team");
  });

  it("keys on the stored role values, like ROLE_LABELS", () => {
    expect(Object.keys(PERJADIN_ROLE_LABELS).sort()).toEqual([...ROLES].sort());
  });
});
