"use client";

import { isDarkTheme } from "-/components/theme-cycle";
import { Switch } from "@sugt/ui/components/switch";
import { cn } from "@sugt/ui/lib/utils";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * The desktop sidebar's theme control (#358): the current theme's icon, **Mode Gelap**, and a
 * `Switch` that is on in Dark. The whole row is a `<label>` around the switch, so a click anywhere
 * on it flips the theme, and the switch takes its accessible name from the label text.
 *
 * Flipping sets the theme the switch now shows — `checked ? "dark" : "light"` — rather than
 * rotating, so what it shows and what it writes cannot disagree (`isDarkTheme`). The rotation in
 * `theme-cycle` is unchanged, and the phone top bar keeps its `ThemeToggle` button (#127); this row
 * is desktop-only, so one theme control shows per breakpoint.
 *
 * **Hydration-safe, by `ThemeToggle`'s pattern** (#302). The stored theme is unknown until mount,
 * so until then this renders an inert, theme-agnostic placeholder — Sun, the switch off — greyed out
 * with `aria-disabled` plus `pointer-events-none opacity-50`, never base-ui's `disabled`, whose
 * state is resolved through a hook and produced a hydration mismatch there. Those are static
 * literals, so the placeholder's markup is the same on the server and the client's first paint.
 */
function ThemeSwitchRow() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <label className={cn(ROW, "pointer-events-none opacity-50")}>
        <Sun className={ICON} />
        <span className="flex-1">Mode Gelap</span>
        <Switch
          checked={false}
          aria-disabled
        />
      </label>
    );
  }

  const dark = isDarkTheme(theme);
  const Icon = dark ? Moon : Sun;

  return (
    <label className={cn(ROW, "cursor-pointer")}>
      <Icon className={ICON} />
      <span className="flex-1">Mode Gelap</span>
      <Switch
        checked={dark}
        onCheckedChange={(checked) => {
          setTheme(checked ? "dark" : "light");
        }}
      />
    </label>
  );
}

const ROW = "flex items-center gap-2.5 px-4 py-3 text-sm";
const ICON = "size-4 text-muted-foreground";

export { ThemeSwitchRow };
