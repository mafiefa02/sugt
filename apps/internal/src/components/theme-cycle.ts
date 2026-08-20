/**
 * The pure core of the theme toggle, with no React and no DOM, so it is tested the way
 * `deriveToolbarState` is — by asserting on values, never by mounting a component.
 *
 * The toggle is one button that rotates **Light ⇄ Dark** — two states, no "System" (the
 * provider sets `enableSystem={false}`, so the stored `theme` is always concrete). `nextTheme`
 * is that rotation and `themeToggleLabel` is the `aria-label` for the button in a given state.
 * Both take `next-themes`' `theme` string, `"light" | "dark"` once mounted but `undefined` for
 * the first paint — an unknown value folds to `light`, which also absorbs a stale persisted
 * `"system"` from before #126 in a single tap.
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
 *  like the rest of the internal UI. */
const LABEL: Record<ThemeSetting, string> = {
  light: "Tema: terang. Ganti ke gelap.",
  dark: "Tema: gelap. Ganti ke terang.",
};

function themeToggleLabel(current: string | undefined): string {
  return LABEL[current as ThemeSetting] ?? LABEL.light;
}

export { nextTheme, themeToggleLabel };
export type { ThemeSetting };
