import {
  parseSidebarState,
  SIDEBAR_STATE_COOKIE,
  sidebarStateCookie,
} from "-/components/sidebar-state";
import { describe, expect, it } from "vitest";

/**
 * **The desktop sidebar's collapsed-or-expanded state, read from its cookie** (#359). Pure — no
 * DOM, no request — so the rule the signed-in layout applies on the server is pinned where it is
 * cheap, the way `theme-cycle` and `table-sort` are. No cookie, or one this code did not write,
 * means expanded: the sidebar is never collapsed by accident.
 */

describe("parseSidebarState", () => {
  it("is expanded when there is no cookie", () => {
    expect(parseSidebarState(undefined)).toBe("expanded");
  });

  it("reads each value it writes", () => {
    expect(parseSidebarState("expanded")).toBe("expanded");
    expect(parseSidebarState("collapsed")).toBe("collapsed");
  });

  it("falls back to expanded on a garbage value", () => {
    for (const value of ["", "true", "Collapsed", " collapsed", "1"]) {
      expect(parseSidebarState(value)).toBe("expanded");
    }
  });
});

describe("sidebarStateCookie", () => {
  it("writes a value parseSidebarState reads back", () => {
    for (const state of ["expanded", "collapsed"] as const) {
      const cookie = sidebarStateCookie(state);
      const [pair] = cookie.split(";");
      const [name, value] = pair!.split("=");
      expect(name).toBe(SIDEBAR_STATE_COOKIE);
      expect(parseSidebarState(value)).toBe(state);
    }
  });

  it("is site-wide and outlives the session", () => {
    const cookie = sidebarStateCookie("collapsed");
    expect(cookie).toContain("path=/");
    expect(cookie).toMatch(/max-age=\d+/);
  });
});
