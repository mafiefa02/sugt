"use client";

import { nextTheme, themeToggleLabel } from "-/components/theme-cycle";
import { Button } from "@sugt/ui/components/button";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * One icon button that rotates System → Light → Dark → System (the cycle and its
 * `aria-label` live in `theme-cycle`). The public app owns this control rather than
 * `@sugt/ui`: the theme control is an app component, not a primitive
 * (`packages/ui/README.md`).
 *
 * **Hydration-safe, and doubly so for the public app.** `next-themes` only knows the
 * stored theme after it reads `localStorage` post-mount, so until `mounted` this renders
 * a stable, theme-agnostic placeholder — the System icon, disabled — identical to the
 * server output. That matters more here than in the internal app: the server HTML is
 * shared across all visitors (ADR-0014), so a control whose first paint depended on a
 * per-user theme would mismatch the cache for everyone.
 */
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Tema"
        disabled
      >
        <Monitor />
      </Button>
    );
  }

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label={themeToggleLabel(theme)}
      onClick={() => setTheme(nextTheme(theme))}
    >
      <Icon />
    </Button>
  );
}

export { ThemeToggle };
