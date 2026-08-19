"use client";

import { AppBrand } from "-/components/app-brand";
import { Button } from "@sugt/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@sugt/ui/components/sheet";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The shell's phone header: a top bar carrying the logo, the `Internal` wordmark and a
 * hamburger, shown only below `md` (`md:hidden`). At `md` and up it is gone and the
 * fixed sidebar in `AppShell` is what renders — desktop is untouched.
 *
 * The hamburger opens the drawer, whose contents are handed in as `children`: the same
 * `SidebarBody` the desktop `<aside>` renders, so the two never drift. That body is a
 * server subtree passed through this client component unchanged — the drawer only adds
 * the `Sheet` and the open state around it.
 *
 * A route change does not dismiss a dialog on its own, and the drawer holds the nav
 * links, so it would outlive every tap. The effect closes it on navigation — browser
 * back and forward included — the way `apps/public`'s `SiteNav` does. `SiteNav` pairs
 * that effect with a per-link `onClick` for the one case the effect cannot see: a tap
 * on the link for the page already open, where the pathname never changes. The drawer's
 * links come from the shared `AppSidebarNav`, which has no handle on this drawer's
 * state, so `closeOnLinkTap` covers that case by delegation instead — any tap that
 * lands on a link is navigation intent.
 */
function AppShellMobileBar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function closeOnLinkTap(event: React.MouseEvent) {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  }

  return (
    <div className="flex h-16 items-center gap-2.5 border-b border-border bg-background px-5 md:hidden">
      <AppBrand />

      <Sheet
        open={open}
        onOpenChange={setOpen}
      >
        <SheetTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              className="ml-auto"
              aria-label="Buka menu"
            >
              <Menu />
            </Button>
          }
        />
        <SheetContent
          side="left"
          className="bg-sidebar p-0"
        >
          {/* The drawer shows the sidebar's own logo header; this title only labels the
              dialog for a screen reader. */}
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          {/* `flex flex-1 flex-col` so the shared SidebarBody's `mt-auto` footer still
              pins to the drawer's bottom, exactly as it does inside the desktop aside. */}
          <div
            className="flex flex-1 flex-col"
            onClick={closeOnLinkTap}
          >
            {children}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export { AppShellMobileBar };
