"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * The internal app's theme provider — `next-themes` configured for the class strategy
 * `@sugt/ui`'s `.dark` block expects (`@custom-variant dark`). It is purely client-side:
 * the stored choice is applied from `localStorage` by the library's pre-paint inline
 * script, so nothing is read on the server and the boundary in AGENTS.md rule 4 is
 * untouched. Each app owns its own provider for the same reason it owns its own shell.
 */
function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
    >
      {children}
    </NextThemesProvider>
  );
}

export { ThemeProvider };
