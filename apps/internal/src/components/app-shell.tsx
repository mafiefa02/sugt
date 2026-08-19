import { AppBrand } from "-/components/app-brand";
import { AppShellMobileBar } from "-/components/app-shell-mobile-bar";
import { AppSidebarNav } from "-/components/app-sidebar";
import type { Role } from "@sugt/domain";
import { Avatar, AvatarFallback } from "@sugt/ui/components/avatar";

/**
 * The internal tool's shell: a fixed 240px sidebar beside a fluid main on a wide
 * viewport, a top bar with a drawer below `md`.
 *
 * It lives in `@sugt/internal` rather than `@sugt/ui` for two reasons. Only this app is
 * shaped this way, and an app owns what only it uses. And the sidebar is filtered by
 * `Role`, which comes from `@sugt/domain` — a package `@sugt/ui` may not import
 * (AGENTS.md rule 4), because both apps depend on it and the public one holds no
 * credentials.
 *
 * The responsive split is a shell job, not a page rewrite: the pages already stack on a
 * phone, and it was the always-on 240px sidebar that stole their width. At `md` and up
 * nothing changes. Below `md` the sidebar hides and `AppShellMobileBar` renders a top
 * bar whose hamburger opens the same `SidebarBody` in a drawer — no `sidebar` primitive
 * in `@sugt/ui` (its absence is documented), only the existing `Sheet`.
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
  const sidebarBody = (
    <SidebarBody
      role={role}
      personName={personName}
      footerAction={footerAction}
    />
  );

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <AppShellMobileBar>{sidebarBody}</AppShellMobileBar>

      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        {sidebarBody}
      </aside>

      <main className="min-w-0 flex-1 bg-background">{children}</main>
    </div>
  );
}

/**
 * The sidebar's contents — logo header, role-filtered nav, avatar/role/sign-out footer —
 * as one subtree shared by the desktop `<aside>` and the phone drawer, so the two cannot
 * drift. It is written to sit inside a flex column that fills its height (both the
 * `<aside>` and the `Sheet` are): `mt-auto` pins the footer to the bottom.
 */
function SidebarBody({
  role,
  personName,
  footerAction,
}: {
  role: Role;
  personName: string;
  footerAction?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
        <AppBrand />
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
    </>
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
