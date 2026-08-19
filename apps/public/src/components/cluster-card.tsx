import type { ScopeCluster } from "-/lib/aggregates-types";
import Link from "next/link";

/**
 * **One Cluster in a list** — its name, the Topic it works on and the Problem it addresses, plus how
 * many Schools it holds and, once there is any, how many Sessions it has delivered.
 *
 * `schoolCount` and `delivered` are derived by the caller from the scope and delivery payloads; a
 * Cluster with no delivery yet is passed `delivered: 0` and simply reads `0` — the site-wide delivery
 * band is what stays hidden until the total is non-zero, not a per-Cluster figure. The whole card
 * links to the Cluster's own page.
 */
function ClusterCard({
  cluster,
  schoolCount,
  delivered,
}: {
  cluster: ScopeCluster;
  schoolCount: number;
  delivered: number;
}) {
  return (
    <Link
      href={`/cluster/${cluster.slug}`}
      className="group flex flex-col gap-3 rounded-lg border border-border p-5 transition-colors hover:border-foreground/30"
    >
      <div>
        <p className="text-xs font-medium text-muted-foreground">{cluster.topic}</p>
        <h3 className="mt-0.5 font-heading text-lg font-semibold group-hover:underline">
          {cluster.name}
        </h3>
      </div>
      <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{cluster.problem}</p>
      <div className="flex gap-6 text-sm tabular-nums">
        <span>
          <span className="font-semibold">{schoolCount}</span>{" "}
          <span className="text-muted-foreground">Sekolah</span>
        </span>
        <span>
          <span className="font-semibold">{delivered}</span>{" "}
          <span className="text-muted-foreground">Sesi terlaksana</span>
        </span>
      </div>
    </Link>
  );
}

export { ClusterCard };
