import type { Role } from "@sugt/domain";
import {
  Boxes,
  CalendarDays,
  ClipboardCheck,
  Gauge,
  LayoutDashboard,
  ListVideo,
  type LucideIcon,
  MessageSquare,
  Newspaper,
  Plane,
  School,
  Users,
} from "lucide-react";
import type { Route } from "next";

type NavItem = {
  href: Route;
  label: string;
  icon: LucideIcon;
  staffOnly: boolean;
  /** Shown only to an Editor / Administrator. Absent means "no Grant gate". */
  editorOnly?: boolean;
  /** Shown only to a Person who may read the Dashboard (`canViewDashboard`). Absent means "no gate". */
  dashboardView?: boolean;
};

/**
 * The sidebar's destinations, in order — with one exception: **Pendamping moves to the top when the
 * viewer cannot see the Dashboard** (#353). The rule is keyed on `canViewDashboard`, not on a Role or
 * Grant name, and it means "if `/` would redirect you to `/pendamping`, Pendamping is your first
 * link" — today only a grant-less Staff. It is not a "home page" rule: sign-in lands every Staff on
 * `/pendamping` whatever their Grants, so for a Staff who sees the Dashboard the top link and the
 * landing page differ, deliberately.
 *
 * `staffOnly` is the sidebar's whole share of the access rule: **delivery data is open,
 * money is not** (ADR-0004). The Perjadin list and detail stay open, because a professor
 * gets a money-free variant of both and needs it to file a Perjadin Evaluation. Cerita is
 * Staff-only for a different reason: publishing is (ADR-0008), and a link to a screen
 * that will refuse you is worse than no link. Arranging delivery — Rencanakan Perjadin and
 * Jadwalkan Sesi Daring — is Staff-only too (the surface list, #9/#70), but those two create-actions
 * are no longer sidebar entries: each is a Staff-only button on its list page (`/perjadin`,
 * `/sesi-daring`) instead (#294), so the sidebar shows only the always-open list links.
 *
 * **Perjadin Report is not here, and its absence is the answer to a question issue #30
 * owned.** The Report is the acquittal state on one `perjadin` row — there is no
 * `perjadin_report` table — so it lives at `/perjadin/[id]/laporan` and is reached from the
 * trip it accounts for. A top-level entry would have needed an index of trips to point at,
 * and nothing asked for one.
 *
 * Omitting a link is not access control. The gate is a Staff-only choke point in the
 * data layer, which is issue #25 rather than this shell.
 *
 * `editorOnly` is a second, narrower dimension beside `staffOnly` (ADR-0028): a link shown only to an
 * Editor (an Administrator implies it). `/pretest` carries it — its page `forbidden()`s a
 * non-holder, so linking a screen that would refuse them is the same "worse than no link" rule the
 * Staff-only entries follow. The shell resolves the Grant once and passes the boolean down.
 *
 * `dashboardView` is a third such dimension (#322): the `/` link is shown only when the viewer may
 * read the Dashboard — a `Pimpinan` by Role, a `Staff` holding `Editor` or `Dashboard Viewer`. Its
 * page redirects a grant-less Staff to `/pendamping`, so — same rule again — the link is hidden for
 * exactly the callers it would bounce. The shell computes `canViewDashboard` once (the one predicate
 * the page guard shares) and passes the boolean down.
 */
const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Gauge, staffOnly: false, dashboardView: true },
  { href: "/kalender", label: "Kalender", icon: CalendarDays, staffOnly: false },
  { href: "/pretest", label: "Pretest", icon: ClipboardCheck, staffOnly: false, editorOnly: true },
  { href: "/pendamping", label: "Pendamping", icon: LayoutDashboard, staffOnly: true },
  { href: "/perjadin", label: "Perjadin", icon: Plane, staffOnly: false },
  { href: "/sesi-daring", label: "Sesi Daring", icon: ListVideo, staffOnly: false },
  { href: "/feedback", label: "Feedback", icon: MessageSquare, staffOnly: false },
  { href: "/cerita", label: "Cerita", icon: Newspaper, staffOnly: true },
  { href: "/sekolah", label: "Direktori Sekolah", icon: School, staffOnly: false },
  { href: "/kelompok-sekolah", label: "Kelompok Sekolah", icon: Boxes, staffOnly: false },
  { href: "/orang", label: "Orang", icon: Users, staffOnly: false },
];

/**
 * **The links one viewer sees, in the order they see them.** A plain module rather than part of the
 * `"use client"` sidebar so the rule is testable without React, the reason `table-sort.ts` is one.
 * The filter decides the set; the Pendamping-first exception only reorders it.
 */
export function sidebarItems({
  role,
  canEditMonitoring,
  canViewDashboard,
}: {
  role: Role;
  canEditMonitoring: boolean;
  canViewDashboard: boolean;
}): NavItem[] {
  const visible = NAV.filter(
    (item) =>
      (!item.staffOnly || role === "Staff") &&
      (!item.editorOnly || canEditMonitoring) &&
      (!item.dashboardView || canViewDashboard),
  );
  if (canViewDashboard) return visible;
  return [
    ...visible.filter((item) => item.href === "/pendamping"),
    ...visible.filter((item) => item.href !== "/pendamping"),
  ];
}
