import { PerjadinPlanForm } from "-/components/perjadin-plan-form";
import { requirePerson } from "-/lib/person";
import { staffSurface } from "-/lib/staff-surface";
import { perjadinPlan } from "@sugt/db/queries";
import { LinkButton } from "@sugt/ui/components/link-button";
import Link from "next/link";

/**
 * **Rencanakan Perjadin** — the trip, its Group and one Session per kept School, planned in
 * one pass.
 *
 * A page rather than a dialog, for the reason Jadwalkan Sesi daring is: a dialog holding a
 * Group and a row per School is a page with a backdrop.
 *
 * **Reached from the nav rather than from a selection made elsewhere.** The trip starts by
 * picking a Sub-Cluster, so it no longer takes a `?sekolah=` set assembled on Coverage — the
 * Sub-Cluster is what decides which Schools may appear at all.
 *
 * **Staff-only, so the read is too.** Without `staffSurface` on the read, a Teaching Team
 * member reaching this URL directly would be shown the whole form and refused only on submit.
 *
 * The route is named after the surface, beside `/jadwalkan-sesi-daring`. The trip that
 * results is read at `/perjadin`, which is a different thing at a different name — one is
 * the act, the other is the record.
 */
export default async function Page() {
  const person = await requirePerson();

  const plan = await staffSurface(() => perjadinPlan(person));
  const hasSubClusters = plan.clusters.some((cluster) => cluster.subClusters.length > 0);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border px-7 py-5">
        <h1 className="font-heading text-lg font-medium">Rencanakan Perjadin</h1>
        <p className="text-sm text-muted-foreground">
          Pilih Kelompok Sekolah, lalu tentukan tanggal dan jam untuk setiap Sekolah yang
          dikunjungi. Tanggal tiap Sesi harus berada di dalam rentang Perjadin.
        </p>
      </header>

      {hasSubClusters ? (
        <PerjadinPlanForm
          clusters={plan.clusters}
          staff={plan.staff}
          teachingTeam={plan.teachingTeam}
        />
      ) : (
        <div className="flex flex-col items-start gap-3.5 p-7">
          <p className="text-sm text-muted-foreground">
            Belum ada Kelompok Sekolah. Buat satu terlebih dahulu untuk merencanakan Perjadin.
          </p>
          <LinkButton
            variant="outline"
            render={<Link href="/kelompok-sekolah" />}
          >
            Ke Kelompok Sekolah
          </LinkButton>
        </div>
      )}
    </div>
  );
}
