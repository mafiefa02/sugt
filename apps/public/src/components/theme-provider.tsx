"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * The public app's theme provider — `next-themes` on the class strategy `@sugt/ui`'s
 * `.dark` block expects.
 *
 * **Client-only, and that is load-bearing here (ADR-0014).** The public site's HTML is
 * shared across every visitor by the pre-cache model, so it must stay theme-agnostic:
 * the stored choice is applied in the browser by `next-themes`' pre-paint inline script
 * from `localStorage`, never read or rendered on the server. Nothing about the theme
 * varies the cached response.
 */
function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
    >
      {children}
    </NextThemesProvider>
  );
}

export { ThemeProvider };
