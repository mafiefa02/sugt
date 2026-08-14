import { DashboardStaff } from "-/components/dashboard-staff";
import { DashboardTeachingTeam } from "-/components/dashboard-teaching-team";
import { requirePerson } from "-/lib/person";
import { staffSurface } from "-/lib/staff-surface";
import { staffDashboard, teachingTeamDashboard } from "@sugt/db/queries";

/**
 * **Beranda** — the landing screen, one per role (#40). A dashboard **assembles** from everything
 * else; it does not invent, so this page is one `requirePerson()`, one dashboard read, and the
 * component that renders it.
 *
 * The two are separate payloads because they are separate screens: the Teaching Team one is
 * money-free and the Staff one reads the Advance strip and the PIC's work behind the Staff-only
 * choke point. The branch is on `role`, so `staffDashboard`'s `requireStaff` never actually
 * refuses here — `staffSurface` wraps it as the correct translation of the guard, not as a case a
 * signed-in Staff member reaches.
 */
export default async function Page() {
  const person = await requirePerson();

  if (person.role === "Staff") {
    const dashboard = await staffSurface(() => staffDashboard(person));
    return <DashboardStaff dashboard={dashboard} />;
  }

  const dashboard = await teachingTeamDashboard(person);
  return <DashboardTeachingTeam dashboard={dashboard} />;
}
