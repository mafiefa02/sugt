/**
 * The pure core of the theme toggle, with no React and no DOM, so it is tested the way
 * `deriveToolbarState` is — by asserting on values, never by mounting a component.
 *
 * The toggle is one button that rotates **System → Light → Dark → System**; `nextTheme`
 * is that rotation and `themeToggleLabel` is the `aria-label` for the button in a given
 * state. Both take `next-themes`' `theme` string, which is `"system" | "light" | "dark"`
 * once mounted but can be `undefined` for the first paint — an unknown value folds to
 * `system` so the first tap always lands on `light`, the same as if it had read `system`.
 */
type ThemeSetting = "system" | "light" | "dark";

const NEXT: Record<ThemeSetting, ThemeSetting> = {
  system: "light",
  light: "dark",
  dark: "system",
};

/** The next setting in the System → Light → Dark → System cycle. */
function nextTheme(current: string | undefined): ThemeSetting {
  return NEXT[(current ?? "system") as ThemeSetting] ?? "light";
}

/** The button's `aria-label`: the current mode, then the mode a tap moves to. Indonesian,
 *  like the rest of the internal UI. */
const LABEL: Record<ThemeSetting, string> = {
  system: "Tema: ikuti sistem. Ganti ke terang.",
  light: "Tema: terang. Ganti ke gelap.",
  dark: "Tema: gelap. Ganti ke ikuti sistem.",
};

function themeToggleLabel(current: string | undefined): string {
  return LABEL[(current ?? "system") as ThemeSetting] ?? LABEL.system;
}

export { nextTheme, themeToggleLabel };
export type { ThemeSetting };
