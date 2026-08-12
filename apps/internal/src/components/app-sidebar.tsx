"use client";

import type { Role } from "@sugt/domain";
import { cn } from "@sugt/ui/lib/utils";
import {
  LayoutDashboard,
  LayoutGrid,
  Newspaper,
  Plane,
  ReceiptText,
  School,
  TriangleAlert,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The sidebar's destinations, in order.
 *
 * `staffOnly` is the sidebar's whole share of the access rule: **delivery data is open,
 * money is not** (ADR-0004). Perjadin Report is the money screen, so a Teaching Team
 * member never sees the link — the Perjadin list and detail stay, because they get a
 * money-free variant of both and need it to file a Perjadin Evaluation. Cerita is
 * Staff-only for a different reason: publishing is (ADR-0008), and a link to a screen
 * that will refuse you is worse than no link.
 *
 * Omitting a link is not access control. The gate is a Staff-only choke point in the
 * data layer, which is issue #25 rather than this shell.
 */
const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, staffOnly: false },
  { href: "/coverage", label: "Coverage", icon: LayoutGrid, staffOnly: false },
  { href: "/sekolah", label: "Direktori Sekolah", icon: School, staffOnly: false },
  { href: "/concerns", label: "Concerns", icon: TriangleAlert, staffOnly: false },
  { href: "/perjadin", label: "Perjadin", icon: Plane, staffOnly: false },
  { href: "/laporan-perjadin", label: "Perjadin Report", icon: ReceiptText, staffOnly: true },
  { href: "/cerita", label: "Cerita", icon: Newspaper, staffOnly: true },
  { href: "/orang", label: "Orang", icon: Users, staffOnly: false },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The sidebar's links. A client component because the current section is read from the
 * URL; the shell around it stays on the server.
 */
function AppSidebarNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const visible = NAV.filter((item) => !item.staffOnly || role === "Staff");

  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {visible.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className={cn("size-4", !active && "text-muted-foreground")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export { AppSidebarNav };
