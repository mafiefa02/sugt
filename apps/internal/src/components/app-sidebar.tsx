"use client";

import { sidebarItems } from "-/components/sidebar-items";
import type { Role } from "@sugt/domain";
import { cn } from "@sugt/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The sidebar's links. A client component because the current section is read from the
 * URL; the shell around it stays on the server. Which links, and in what order, is `sidebarItems`.
 */
function AppSidebarNav({
  role,
  canEditMonitoring,
  canViewDashboard,
}: {
  role: Role;
  canEditMonitoring: boolean;
  canViewDashboard: boolean;
}) {
  const pathname = usePathname();
  const visible = sidebarItems({ role, canEditMonitoring, canViewDashboard });

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
