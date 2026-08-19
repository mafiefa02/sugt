/**
 * The pure core of the public app's theme toggle — no React, no DOM. It is a deliberate
 * twin of `apps/internal/src/components/theme-cycle.ts`: the ticket and
 * `packages/ui/README.md` put the theme control in each app rather than in a shared
 * `@sugt/ui` primitive, and the boundary (ADR-0001: the public app depends on no
 * app-internal code) means the two apps do not import from each other. Six lines of pure
 * string rotation living in both apps is the cost of that boundary, chosen over widening
 * `@sugt/ui`.
 *
 * The toggle rotates **System → Light → Dark → System**; `nextTheme` is that rotation and
 * `themeToggleLabel` is the button's `aria-label`. Both take `next-themes`' `theme`, which
 * is `"system" | "light" | "dark"` once mounted but `undefined` before — an unknown value
 * folds to `system` so the first tap always lands on `light`.
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
 *  like the rest of the public UI. */
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
