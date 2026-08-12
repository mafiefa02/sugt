import { PerjadinPlanForm } from "-/components/perjadin-plan-form";
import { requirePerson } from "-/lib/person";
import { staffSurface } from "-/lib/staff-surface";
import { perjadinPlan } from "@sugt/db/queries";
import { Button } from "@sugt/ui/components/button";
import Link from "next/link";

/**
 * **Rencanakan Perjadin** — the trip, its Group and one Session per selected School,
 * planned in one pass.
 *
 * A page rather than a dialog, for the reason Jadwalkan Sesi daring is: a dialog holding a
 * Group and a row per School is a page with a backdrop.
 *
 * **Staff-only, so the read is too.** Without `staffSurface` on the read, a Teaching Team
 * member reaching this URL directly would be shown the whole form and refused only on
 * submit.
 *
 * The route is named after the surface, beside `/jadwalkan-sesi-daring`. The trip that
 * results is read at `/perjadin`, which is a different thing at a different name — one is
 * the act, the other is the record.
 */
export default async function Page({ searchParams }: PageProps<"/rencanakan-perjadin">) {
  const person = await requirePerson();
  const { sekolah } = await searchParams;

  const plan = await staffSurface(() => perjadinPlan(person, selectionFrom(sekolah)));

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border px-7 py-5">
        <h1 className="font-heading text-lg font-medium">Rencanakan Perjadin</h1>
        <p className="text-sm text-muted-foreground">
          Satu Sesi luring untuk setiap Sekolah yang dipilih. Tanggal tiap Sesi harus berada di
          dalam rentang Perjadin.
        </p>
      </header>

      {plan.schools.length === 0 ? (
        <div className="flex flex-col items-start gap-3.5 p-7">
          <p className="text-sm text-muted-foreground">
            Tidak ada Sekolah yang dipilih. Pilih Sekolah di Coverage terlebih dahulu.
          </p>
          <Button
            variant="outline"
            render={<Link href="/coverage" />}
          >
            Kembali ke Coverage
          </Button>
        </div>
      ) : (
        <PerjadinPlanForm
          schools={plan.schools}
          staff={plan.staff}
          teachingTeam={plan.teachingTeam}
        />
      )}
    </div>
  );
}

/**
 * The Coverage selection, as it survives a URL. Identical in shape to Jadwalkan Sesi
 * daring's, and for the same reasons: the selection is transient, is thrown away on
 * navigation, and is an argument to this screen rather than anything stored.
 *
 * Ids matching no School are not filtered here. `perjadinPlan` drops them, and the form
 * lists every School it is about to plan a Session for by name, so a dropped id shows up
 * as an absence a reader can see rather than as an error page.
 */
function selectionFrom(sekolah: string | string[] | undefined): string[] {
  if (sekolah === undefined) return [];

  return (Array.isArray(sekolah) ? sekolah : [sekolah])
    .flatMap((value) => value.split(","))
    .filter((value) => value.length > 0);
}
