import { ConcernsList } from "-/components/concerns-list";
import { requirePerson } from "-/lib/person";
import { concerns } from "@sugt/db/queries";
import { CONCERN_AT_OR_BELOW } from "@sugt/domain";

/**
 * **Concerns** — every Aspect anyone Rated at or below the threshold, across all four evaluation
 * forms, newest first. The one place Ratings are aggregated, and the reason they are collected.
 *
 * One `requirePerson()` and one query, **no role check**: a Rating carries no money, so ADR-0004
 * opens it to everyone signed in — a professor about to travel to a Cluster reads what the last
 * group found there. The `concerns` query holds no `requireStaff` for the same reason.
 */
export default async function Page() {
  const person = await requirePerson();
  const list = await concerns(person);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border px-7 py-5">
        <h1 className="font-heading text-lg font-medium">Concerns</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Setiap Aspek yang dinilai {CONCERN_AT_OR_BELOW} ke bawah, dari keempat formulir, terbaru
          dulu. Satu nilai rendah sudah cukup — tidak pernah dirata-rata.
        </p>
      </header>

      <ConcernsList concerns={list} />
    </div>
  );
}
