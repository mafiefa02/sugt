"use client";

import { Button } from "@sugt/ui/components/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@sugt/ui/components/sheet";
import { cn } from "@sugt/ui/lib/utils";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The four public sections, in the order the header lists them. Pencarian and the
 * Story detail routes are reached from inside a page rather than from the header, and
 * each surface itself belongs to its own ticket — this names the destinations only.
 */
const SECTIONS = [
  { href: "/program", label: "Program" },
  { href: "/cluster", label: "Cluster" },
  { href: "/cerita", label: "Cerita" },
  { href: "/tentang", label: "Tentang" },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The header's navigation: four links on a wide viewport, the same four behind a menu
 * on a phone. A client component because the active section is read from the URL.
 */
function SiteNav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="hidden items-center gap-7 md:flex">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className={cn(
              "text-sm font-medium text-foreground",
              isActive(pathname, section.href) && "font-semibold text-primary",
            )}
          >
            {section.label}
          </Link>
        ))}
        {/* The handoff's header carries a "Portal Internal" button beside these four.
            It is left out rather than drawn dead: it points at the internal tool, which
            sits on its own domain, and that domain is issue #19's to hand over. It is a
            plain link to another origin when it arrives, not a route of this app. */}
      </nav>

      <Sheet>
        <SheetTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              className="md:hidden"
              aria-label="Buka menu"
            >
              <Menu />
            </Button>
          }
        />
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4">
            {SECTIONS.map((section) => (
              /* Closing on navigation is explicit: the menu is a dialog, and a route
                 change does not dismiss one by itself. */
              <SheetClose
                key={section.href}
                render={<Link href={section.href} />}
                className={cn(
                  "rounded-md px-3 py-2 text-left text-sm font-medium text-foreground",
                  isActive(pathname, section.href) && "bg-muted font-semibold text-primary",
                )}
              >
                {section.label}
              </SheetClose>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}

export { SiteNav };
