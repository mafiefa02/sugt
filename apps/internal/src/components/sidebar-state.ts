/**
 * **The desktop sidebar's state — expanded (288px) or collapsed to a 64px icon rail — and its
 * cookie** (#359). A plain module, not a `"use client"` file, so the signed-in layout can read it
 * on the server and the rule is tested the way `theme-cycle` is, by asserting on values.
 *
 * A cookie rather than `localStorage` because the server has to know the state before it renders:
 * the layout reads it and the first paint already has the right width. `localStorage` is readable
 * only after mount, which would flash the expanded width on every reload of a collapsed sidebar.
 */
type SidebarState = "expanded" | "collapsed";

const SIDEBAR_STATE_COOKIE = "sidebar_state";

/** A year: the choice is a preference, not a session detail. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * The state a cookie value names. No cookie, or a value this module did not write, is
 * **expanded** — the sidebar is never collapsed by accident.
 */
function parseSidebarState(value: string | undefined): SidebarState {
  return value === "collapsed" ? "collapsed" : "expanded";
}

/** The `document.cookie` assignment that stores `state` for every page of the app. */
function sidebarStateCookie(state: SidebarState): string {
  return `${SIDEBAR_STATE_COOKIE}=${state}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}

export { parseSidebarState, SIDEBAR_STATE_COOKIE, sidebarStateCookie };
export type { SidebarState };
