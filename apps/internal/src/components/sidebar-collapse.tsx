"use client";

import { AppBrand, Logomark } from "-/components/app-brand";
import { sidebarStateCookie, type SidebarState } from "-/components/sidebar-state";
import { themeToggleLabel } from "-/components/theme-cycle";
import { ThemeToggle } from "-/components/theme-toggle";
import { Avatar, AvatarFallback } from "@sugt/ui/components/avatar";
import { Button } from "@sugt/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@sugt/ui/components/tooltip";
import { cn } from "@sugt/ui/lib/utils";
import { PanelLeft } from "lucide-react";
import { useTheme } from "next-themes";
import {
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";

/**
 * **The desktop sidebar's collapse (#359): 288px expanded, or a 64px icon rail.**
 *
 * `DesktopSidebar` holds the state and is the `<aside>`. The state starts from the cookie the
 * signed-in layout read on the server (`sidebar-state.ts`), so the first paint already has the
 * right width, and every toggle writes the cookie back — surviving navigation (the shell lives in
 * the layout) and reloads.
 *
 * The collapsed layout is drawn by CSS, not by re-rendering the shared `SidebarBody`: the aside
 * carries `data-state` and the body's parts restyle through `group-data-[state=collapsed]/sidebar:`.
 * That keeps the body a server subtree, and it is why the **phone drawer never collapses** — it
 * renders the same body outside this aside, where no such group exists. What does need the state
 * in JavaScript — the header's toggle and the collapsed-only tooltips — reads it from context,
 * whose default (the drawer's) is expanded with no toggle, so the drawer shows no toggle either.
 *
 * The width animates over 200ms and pushes `<main>` (the aside is a flex item beside it, never an
 * overlay); `motion-reduce` makes it instant. The aside clips horizontally, so labels are cut off
 * as it narrows rather than wrapped.
 */
const SidebarCollapseContext = createContext<{ collapsed: boolean; toggle: (() => void) | null }>({
  collapsed: false,
  toggle: null,
});

function DesktopSidebar({
  initialState,
  children,
}: {
  initialState: SidebarState;
  children: React.ReactNode;
}) {
  const [state, setState] = useState(initialState);
  const collapsed = state === "collapsed";

  function toggle() {
    const next: SidebarState = collapsed ? "expanded" : "collapsed";
    setState(next);
    document.cookie = sidebarStateCookie(next);
  }

  return (
    <SidebarCollapseContext value={{ collapsed, toggle }}>
      <TooltipProvider>
        {/*
          Clamp the sidebar to the viewport and pin it: `h-dvh` + `sticky top-0` keep the footer
          on screen while `<main>` scrolls under it (#119). The explicit `h-dvh` also defeats the
          flex row's default `align-items: stretch`, and `overflow-y-auto` lets the aside scroll
          internally if its nav and footer ever exceed the viewport, keeping the footer reachable.
          `overflow-x-hidden` is what clips the labels while the width animates.
        */}
        <aside
          data-state={state}
          className={cn(
            "group/sidebar sticky top-0 hidden h-dvh shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out motion-reduce:transition-none md:flex",
            collapsed ? "w-16" : "w-72",
          )}
        >
          {children}
        </aside>
      </TooltipProvider>
    </SidebarCollapseContext>
  );
}

function useSidebarCollapse() {
  return useContext(SidebarCollapseContext);
}

/**
 * The sidebar's header. Expanded, it is the brand (linking home) with a **Tutup sidebar** button on
 * the right. Collapsed, it is the logomark alone — no longer a home link but the **Buka sidebar**
 * button, which turns into the same panel icon on hover and on keyboard focus. In the drawer there is
 * no toggle, so it is the brand alone.
 *
 * The two states render different buttons, so toggling unmounts the one that was pressed. Focus is
 * handed to its counterpart afterwards, so a keyboard user stays on the control rather than being
 * dropped to `<body>`.
 */
function SidebarHeader() {
  const { collapsed, toggle } = useSidebarCollapse();
  const button = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);

  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    button.current?.focus();
  }, [collapsed]);

  function toggleKeepingFocus() {
    refocus.current = true;
    toggle?.();
  }

  if (collapsed && toggle) {
    return (
      <div className="flex h-16 shrink-0 items-center justify-center border-b border-sidebar-border">
        <button
          ref={button}
          type="button"
          aria-label="Buka sidebar"
          onClick={toggleKeepingFocus}
          className="group/expand relative grid size-9 place-items-center rounded-md outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logomark
            alt=""
            className="group-hover/expand:opacity-0 group-focus-visible/expand:opacity-0"
          />
          <PanelLeft className="absolute size-4 opacity-0 group-hover/expand:opacity-100 group-focus-visible/expand:opacity-100" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-5">
      <AppBrand />
      {toggle ? (
        <Button
          ref={button}
          variant="ghost"
          size="icon-sm"
          aria-label="Tutup sidebar"
          className="ml-auto shrink-0"
          onClick={toggleKeepingFocus}
        >
          <PanelLeft />
        </Button>
      ) : null}
    </div>
  );
}

/**
 * `children` inside `render` (a span by default), with a tooltip on the right **only while the rail
 * is collapsed**. Expanded — and in the drawer — it is just `render` holding `children`, since the
 * labels are on screen and a tooltip repeating them would be noise.
 *
 * `render` must be created on the client. An element a server component passes down may arrive as a
 * lazy reference (outlined, or a client component whose chunk is still loading), which
 * `cloneElement` cannot clone — it crashed the expanded server render once, and is the reason
 * `RailFooter` is a client component rather than markup in `SidebarBody`.
 */
function RailTooltip({
  label,
  render = <span className="inline-flex" />,
  children,
}: {
  label: string;
  render?: ReactElement;
  children: React.ReactNode;
}) {
  const { collapsed } = useSidebarCollapse();

  if (!collapsed) return cloneElement(render, undefined, children);

  return (
    <Tooltip>
      <TooltipTrigger render={render}>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/** The collapsed footer's theme button: `ThemeToggle`, tooltipped with its own current label. */
function RailThemeToggle() {
  const { theme } = useTheme();

  return (
    <RailTooltip label={themeToggleLabel(theme)}>
      <ThemeToggle />
    </RailTooltip>
  );
}

/**
 * The collapsed rail's footer, stacked: the theme button, a border, the avatar, and sign-out beneath
 * it — each tooltipped, so sign-out stays reachable without expanding (#119, #122). `SidebarBody`
 * shows it only inside a collapsed aside. The avatar is focusable — a tab stop that does nothing
 * else — because #359 asks for its tooltip (the Person's name, which the rail no longer prints) on
 * keyboard focus as well as hover; `role="img"` with `aria-label` gives a screen reader the same
 * name.
 */
function RailFooter({
  personName,
  initials,
  footerAction,
}: {
  personName: string;
  initials: string;
  footerAction?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-3">
      <RailThemeToggle />
      <div className="w-8 border-t border-sidebar-border" />
      <RailTooltip
        label={personName}
        render={
          <span
            tabIndex={0}
            role="img"
            aria-label={personName}
            className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <Avatar>
          <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
      </RailTooltip>
      {footerAction ? <RailTooltip label="Keluar">{footerAction}</RailTooltip> : null}
    </div>
  );
}

export { DesktopSidebar, RailFooter, RailTooltip, SidebarHeader };
