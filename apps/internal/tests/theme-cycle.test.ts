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
  it("rotates System → Light → Dark → System", () => {
    expect(nextTheme("system")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
  });

  it("folds an unknown or pre-mount value to the System step, so the first tap lands on Light", () => {
    expect(nextTheme(undefined)).toBe("light");
    expect(nextTheme("")).toBe("light");
    expect(nextTheme("garbage")).toBe("light");
  });

  it("cycles back to its start in exactly three taps", () => {
    let theme: string = "system";
    theme = nextTheme(theme);
    theme = nextTheme(theme);
    theme = nextTheme(theme);
    expect(theme).toBe("system");
  });
});

describe("themeToggleLabel", () => {
  it("names the current mode and the mode a tap moves to", () => {
    expect(themeToggleLabel("system")).toBe("Tema: ikuti sistem. Ganti ke terang.");
    expect(themeToggleLabel("light")).toBe("Tema: terang. Ganti ke gelap.");
    expect(themeToggleLabel("dark")).toBe("Tema: gelap. Ganti ke ikuti sistem.");
  });

  it("labels an unknown or pre-mount value as the System state", () => {
    expect(themeToggleLabel(undefined)).toBe("Tema: ikuti sistem. Ganti ke terang.");
    expect(themeToggleLabel("garbage")).toBe("Tema: ikuti sistem. Ganti ke terang.");
  });

  it("the label's promised next mode matches nextTheme for every state", () => {
    const spoken: Record<string, string> = {
      system: "terang",
      light: "gelap",
      dark: "ikuti sistem",
    };
    const named: Record<string, string> = {
      light: "terang",
      dark: "gelap",
      system: "ikuti sistem",
    };
    for (const state of ["system", "light", "dark"]) {
      expect(themeToggleLabel(state)).toContain(`Ganti ke ${spoken[state]}`);
      expect(named[nextTheme(state)]).toBe(spoken[state]);
    }
  });
});
