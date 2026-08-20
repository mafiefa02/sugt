"use client";

import { nextTheme, themeToggleLabel } from "-/components/theme-cycle";
import { Button } from "@sugt/ui/components/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * One icon button that toggles Light ⇄ Dark (the rotation and its `aria-label` live in
 * `theme-cycle`, which is where they are tested). The internal app owns this control rather
 * than `@sugt/ui`: the theme control is an app component, not a primitive
 * (`packages/ui/README.md`), and no `dropdown-menu`/`switch` primitive is added.
 *
 * **Hydration-safe.** `next-themes` cannot know the stored theme until it has read
 * `localStorage`, which only happens after mount, so the first server/client paint must
 * not depend on it. Until `mounted`, render a stable, theme-agnostic placeholder — the Sun
 * icon, disabled — matching what the server sent; swap to the live control once mounted.
 * Without this the button's icon and label would differ between server and client and React
 * would warn.
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
        <Sun />
      </Button>
    );
  }

  const Icon = theme === "dark" ? Moon : Sun;

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
