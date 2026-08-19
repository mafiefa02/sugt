"use client";

import { Button } from "@sugt/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@sugt/ui/components/sheet";
import { Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import logoSekolahGaruda from "../../public/logo-sekolah-garuda.png";

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
 * back and forward included — the way `apps/public`'s `SiteNav` does.
 */
function AppShellMobileBar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-16 items-center gap-2.5 border-b border-border bg-background px-5 md:hidden">
      <Link href="/">
        <Image
          src={logoSekolahGaruda}
          alt="Sekolah Garuda"
          className="h-6 w-auto"
          priority
        />
      </Link>
      <span className="text-[10.5px] font-medium text-muted-foreground">Internal</span>

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
          {children}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export { AppShellMobileBar };
