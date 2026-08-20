import { nextTheme, themeToggleLabel } from "-/components/theme-cycle";
import { describe, expect, it } from "vitest";

/**
 * **The pure theme-cycle logic, tested with no database and no DOM.**
 *
 * Like `toolbar-state.test.ts`, this file touches neither Postgres nor a browser — it
 * asserts on `nextTheme` / `themeToggleLabel`, both pure `string | undefined → string`
 * functions. It sits in the suite only because `pnpm --filter @sugt/internal test` is one
 * Vitest project today; whoever later splits the pure tests off can lift it out untouched.
 */
describe("nextTheme", () => {
  it("rotates Light ⇄ Dark", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
  });

  it("folds an unknown, stale, or pre-mount value to Light", () => {
    expect(nextTheme(undefined)).toBe("light");
    expect(nextTheme("")).toBe("light");
    expect(nextTheme("garbage")).toBe("light");
    // A theme stored as "system" before #126 is unknown now — one tap heals it to Light.
    expect(nextTheme("system")).toBe("light");
  });

  it("returns to its start in exactly two taps", () => {
    let theme: string = "light";
    theme = nextTheme(theme);
    theme = nextTheme(theme);
    expect(theme).toBe("light");
  });
});

describe("themeToggleLabel", () => {
  it("names the current mode and the mode a tap moves to", () => {
    expect(themeToggleLabel("light")).toBe("Tema: terang. Ganti ke gelap.");
    expect(themeToggleLabel("dark")).toBe("Tema: gelap. Ganti ke terang.");
  });

  it("labels an unknown, stale, or pre-mount value as Light", () => {
    expect(themeToggleLabel(undefined)).toBe("Tema: terang. Ganti ke gelap.");
    expect(themeToggleLabel("garbage")).toBe("Tema: terang. Ganti ke gelap.");
    expect(themeToggleLabel("system")).toBe("Tema: terang. Ganti ke gelap.");
  });

  it("the label's promised next mode matches nextTheme for every state", () => {
    const spoken: Record<string, string> = {
      light: "gelap",
      dark: "terang",
    };
    const named: Record<string, string> = {
      light: "terang",
      dark: "gelap",
    };
    for (const state of ["light", "dark"]) {
      expect(themeToggleLabel(state)).toContain(`Ganti ke ${spoken[state]}`);
      expect(named[nextTheme(state)]).toBe(spoken[state]);
    }
  });
});
