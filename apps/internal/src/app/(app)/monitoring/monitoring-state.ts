import type { Role } from "@sugt/domain";

/**
 * **The pure core of `/monitoring`, with no React and no DOM**, so it is tested the way
 * `theme-cycle.ts` and `deriveToolbarState` are — by asserting on values, never by mounting a
 * component. The page's only moving parts are two small decisions, and both live here as plain
 * functions the browser calls and the suite drives directly:
 *
 *   1. **`showBudget`** — the money gate. Today it is a no-op (`Role` is only `"Staff"`), but it
 *      is written as the real predicate so that the first non-Staff signed-in role lands with the
 *      budget already hidden, honouring ADR-0004. Testing the value, not the render, is what lets
 *      the suite prove the gate for a role that does not exist yet.
 *   2. **The dismiss state machine** — a warning the operator sets aside moves from `active` to the
 *      end of `ignored`. Modelled as two immutable lists so a reducer over them is a pure
 *      `(state, id) → state`, with the view holding the current state in `useState`.
 */

/** A single monitoring warning: a stable id and the human message shown in the banner. */
export type Warning = { id: string; message: string };

/** The two lists the banner and the "ignored" accordion read from. */
export type WarningState = { active: Warning[]; ignored: Warning[] };

/**
 * Whether to render the budget figures. `true` only for `"Staff"` — the single role today, so this
 * is a no-op guard now, but it is the real ADR-0004 rule: the moment a non-Staff signed-in role
 * exists, money is hidden from it with no further change here. Written as the predicate (not a
 * literal `true`) precisely so the test can assert it excludes a non-Staff role.
 */
export function showBudget(role: Role): boolean {
  return role === "Staff";
}

/** The starting state: every warning active, nothing ignored yet. Copies the input so the caller's
 *  array is never aliased into the state. */
export function initialWarningState(warnings: Warning[]): WarningState {
  return { active: [...warnings], ignored: [] };
}

/**
 * Set a warning aside. Returns a NEW state with the warning whose id matches moved from `active` to
 * the END of `ignored`, preserving the order of the rest. An id not currently active is a no-op —
 * a fresh, structurally-equal state, with nothing duplicated. The input arrays are never mutated.
 */
export function dismissWarning(state: WarningState, id: string): WarningState {
  const moved = state.active.find((w) => w.id === id);
  if (!moved) {
    return { active: [...state.active], ignored: [...state.ignored] };
  }
  return {
    active: state.active.filter((w) => w.id !== id),
    ignored: [...state.ignored, moved],
  };
}
