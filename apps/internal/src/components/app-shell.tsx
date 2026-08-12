import { AppSidebarNav } from "-/components/app-sidebar";
import type { Role } from "@sugt/domain";
import { Avatar, AvatarFallback } from "@sugt/ui/components/avatar";
import Image from "next/image";
import Link from "next/link";

import logoSekolahGaruda from "../../public/logo-sekolah-garuda.png";

/**
 * The internal tool's shell: a fixed 240px sidebar beside a fluid main.
 *
 * It lives in `@sugt/internal` rather than `@sugt/ui` for two reasons. Only this app is
 * shaped this way, and an app owns what only it uses. And the sidebar is filtered by
 * `Role`, which comes from `@sugt/domain` — a package `@sugt/ui` may not import
 * (AGENTS.md rule 4), because both apps depend on it and the public one holds no
 * credentials.
 *
 * `role` is a prop rather than a session read, so the shell stays a plain component —
 * the signed-in layout does the reading and passes it down.
 */
function AppShell({
  role,
  personName,
  footerAction,
  children,
}: {
  role: Role;
  personName: string;
  /** Sits beside the avatar block. Sign-out, once there is a session to end. */
  footerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
          <Link href="/">
            <Image
              src={logoSekolahGaruda}
              alt="Sekolah Garuda"
              className="h-6 w-auto"
              priority
            />
          </Link>
          <span className="text-[10.5px] font-medium text-muted-foreground">Internal</span>
        </div>

        <AppSidebarNav role={role} />

        <div className="mt-auto flex items-center gap-2.5 border-t border-sidebar-border p-4">
          <Avatar>
            <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
              {initials(personName)}
            </AvatarFallback>
          </Avatar>
          <div className="leading-tight">
            <div className="text-sm font-medium">{personName}</div>
            <div className="text-xs text-muted-foreground">{role}</div>
          </div>
          {footerAction ? <div className="ml-auto">{footerAction}</div> : null}
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-background">{children}</main>
    </div>
  );
}

/** Two letters for the sidebar's avatar. A Person is named before they ever sign in. */
function initials(personName: string) {
  return personName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export { AppShell };
