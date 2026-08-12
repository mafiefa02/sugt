import { CoverageList } from "-/components/coverage-list";
import { requirePerson } from "-/lib/person";
import { coverage } from "@sugt/db/queries";
import { TOTAL_SESSIONS_PER_SCHOOL } from "@sugt/domain";

/**
 * **Coverage** — the landing screen for trip planning, and the first real read
 * through `@sugt/db`'s query layer.
 *
 * One `requirePerson()`, one query, one payload. The Person is not re-resolved
 * anywhere below: `requirePerson()` shares its memoised read with the signed-in
 * layout, so this page costs no second round trip, and the query takes the Person it
 * produced rather than resolving one of its own.
 *
 * The route stays at `/coverage`. This ticket owns the slug and could move it, but
 * the surface is called Coverage in the enumerated list and in the sidebar, and
 * renaming the directory would buy a second name for one screen.
 */
export default async function Page() {
  const person = await requirePerson();
  const clusters = await coverage(person);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border px-7 py-5">
        <h1 className="font-heading text-lg font-medium">Coverage</h1>
        <p className="text-sm text-muted-foreground">
          Setiap Sekolah dengan jumlah Sesi terlaksana, dikelompokkan per Cluster.
        </p>
      </header>

      {clusters.length === 0 ? (
        <p className="p-7 text-sm text-muted-foreground">
          Belum ada data Sekolah. Jalankan seed data referensi.
        </p>
      ) : (
        <CoverageList
          clusters={clusters}
          sessionsPerSchool={TOTAL_SESSIONS_PER_SCHOOL}
          /**
           * Both actions on a selection — Rencanakan Perjadin and Jadwalkan Sesi
           * daring — are Staff-only, so a Teaching Team member reads the counts and
           * is offered no selection. ADR-0004 opens the counts themselves to
           * everyone signed in, which is why the query above applies no role check.
           */
          selectable={person.role === "Staff"}
        />
      )}
    </div>
  );
}
