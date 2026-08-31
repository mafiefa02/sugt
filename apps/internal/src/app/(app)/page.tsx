import { DashboardStaff } from "-/components/dashboard-staff";
import { requirePerson } from "-/lib/person";
import { staffSurface } from "-/lib/staff-surface";
import { staffDashboard } from "@sugt/db/queries";

/**
 * **Beranda** — the landing screen (#40). A dashboard **assembles** from everything else; it does
 * not invent, so this page is one `requirePerson()`, one dashboard read, and the component that
 * renders it.
 *
 * **One dashboard now** (T3, #153). There used to be a second, money-free landing for
 * Teaching-Team professors, branched on `role`; the `Teaching Team` Person role is retired, so
 * every signed-in Person is Staff and there is only the Staff dashboard. `staffDashboard`'s
 * `requireStaff` therefore never actually refuses here — `staffSurface` wraps it as the correct
 * translation of the guard (defense in depth), not as a case a signed-in Person reaches.
 */
export default async function Page() {
  const person = await requirePerson();

  const dashboard = await staffSurface(() => staffDashboard(person));
  return <DashboardStaff dashboard={dashboard} />;
}
