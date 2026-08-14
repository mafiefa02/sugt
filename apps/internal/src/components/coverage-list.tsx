import type { CoverageCluster, CoverageSchool } from "@sugt/db/queries";
import { TOTAL_SESSIONS_PER_SCHOOL } from "@sugt/domain";
import { Progress } from "@sugt/ui/components/progress";

/**
 * Coverage's Schools, each with its delivered count, grouped by Cluster.
 *
 * A read surface and nothing else. It once carried a multi-selection the two arranging
 * actions started from; neither takes one now — a trip is planned around a Sub-Cluster
 * on its own screen, and an online Session is arranged one School at a time — so there
 * is nothing left for a selection to mean and there is none. The counts arrive from the
 * server as props; nothing here fetches and nothing here is interactive.
 *
 * **Grouped by Cluster, not Sub-Cluster.** Regrouping by Sub-Cluster was considered and
 * rejected: Coverage answers "where are we overall", which is a Cluster-level question,
 * and the Sub-Cluster is a planning unit that belongs on the planning screen.
 */
function CoverageList({ clusters }: { clusters: CoverageCluster[] }) {
  return (
    <div className="p-7">
      {clusters.map((cluster) => (
        <section
          key={cluster.id}
          className="mb-7"
        >
          <div className="mb-2.5 flex items-baseline gap-2.5">
            <h2 className="font-heading text-base font-semibold">{cluster.name}</h2>
            <span className="text-xs text-muted-foreground">Topik: {cluster.topic}</span>
          </div>

          <div className="border-t border-border">
            {cluster.schools.map((school) => (
              <SchoolRow
                key={school.id}
                school={school}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * One School: how much teaching has happened, against the fixed ten.
 *
 * **It shows counts and nothing else.** Nothing is ever overdue, because no Session
 * ever asserted a due date, so a School behind on pace shows a low number and noticing
 * that is a human reading it. Pace and health are different questions, and Concerns is
 * the other screen.
 *
 * The meter is the design handoff's, and it restates the count rather than judging it:
 * one length, one colour, no ramp and no threshold. That is the distinction
 * `docs/product.md` draws when it rules out a health indicator — a Rating's severity
 * ramp belongs to the two Rating controls, and deliberately not here.
 */
function SchoolRow({ school }: { school: CoverageSchool }) {
  return (
    <div className="flex items-center gap-3.5 border-b border-border px-4 py-3">
      <span className="flex-1 text-sm font-medium">{school.name}</span>
      <span className="hidden text-xs text-muted-foreground sm:inline">{school.kabupatenKota}</span>

      <span className="text-[13px] text-muted-foreground tabular-nums">
        {school.deliveredSessions} / {TOTAL_SESSIONS_PER_SCHOOL}
      </span>
      <Progress
        className="w-21 shrink-0"
        value={school.deliveredSessions}
        max={TOTAL_SESSIONS_PER_SCHOOL}
        aria-label={`${school.name}: ${school.deliveredSessions} dari ${TOTAL_SESSIONS_PER_SCHOOL} Sesi terlaksana`}
      />
    </div>
  );
}

export { CoverageList };
