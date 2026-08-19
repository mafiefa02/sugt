import { Band } from "-/components/band";
import { ClusterCard } from "-/components/cluster-card";
import { getDelivery, getScope } from "-/lib/aggregates";
import { clusterFigures } from "-/lib/figures";
import type { Metadata } from "next";

/**
 * **Cluster — the four Clusters, each a card.**
 *
 * A Cluster is a Topic and the Problem it addresses, worked by a set of Schools. The card carries the
 * School count and, once there is any, the delivered count; the whole list is the four Clusters in
 * the scope payload's order.
 */
export const metadata: Metadata = { title: "Cluster" };

export const revalidate = 3600;

export default async function Page() {
  const [scope, delivery] = await Promise.all([getScope(), getDelivery()]);
  const clusters = clusterFigures(scope, delivery);

  return (
    <Band className="py-16">
      <h1 className="font-heading text-4xl font-bold tracking-tight">Cluster</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        Empat Cluster, masing-masing menggarap satu Topik dan menjawab satu Masalah bersama
        Sekolah-Sekolahnya.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {clusters.map(({ cluster, schoolCount, delivered }) => (
          <ClusterCard
            key={cluster.id}
            cluster={cluster}
            schoolCount={schoolCount}
            delivered={delivered}
          />
        ))}
      </div>
    </Band>
  );
}
