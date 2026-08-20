/**
 * The pure core of the public app's theme toggle — no React, no DOM. It is a deliberate
 * twin of `apps/internal/src/components/theme-cycle.ts`: the ticket and
 * `packages/ui/README.md` put the theme control in each app rather than in a shared
 * `@sugt/ui` primitive, and the boundary (ADR-0001: the public app depends on no
 * app-internal code) means the two apps do not import from each other. Six lines of pure
 * string rotation living in both apps is the cost of that boundary, chosen over widening
 * `@sugt/ui`.
 *
 * The toggle rotates **Light ⇄ Dark** — two states, no "System" (the provider sets
 * `enableSystem={false}`, so the stored `theme` is always concrete). `nextTheme` is that
 * rotation and `themeToggleLabel` is the button's `aria-label`. Both take `next-themes`'
 * `theme`, `"light" | "dark"` once mounted but `undefined` before — an unknown value folds to
 * `light`, which also absorbs a stale persisted `"system"` from before #126 in a single tap.
 */
type ThemeSetting = "light" | "dark";

const NEXT: Record<ThemeSetting, ThemeSetting> = {
  light: "dark",
  dark: "light",
};

/** The other of the two themes — Light ⇄ Dark — folding any unknown/stale value to `light`. */
function nextTheme(current: string | undefined): ThemeSetting {
  return NEXT[current as ThemeSetting] ?? "light";
}

/** The button's `aria-label`: the current mode, then the mode a tap moves to. Indonesian,
 *  like the rest of the public UI. */
const LABEL: Record<ThemeSetting, string> = {
  light: "Tema: terang. Ganti ke gelap.",
  dark: "Tema: gelap. Ganti ke terang.",
};

function themeToggleLabel(current: string | undefined): string {
  return LABEL[current as ThemeSetting] ?? LABEL.light;
}

export { nextTheme, themeToggleLabel };
export type { ThemeSetting };
