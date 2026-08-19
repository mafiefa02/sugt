import { Band } from "-/components/band";
import { ClusterCard } from "-/components/cluster-card";
import { DeliveryBand } from "-/components/delivery-band";
import { SchoolList } from "-/components/school-list";
import { Stat } from "-/components/stat";
import { getDelivery, getScope } from "-/lib/aggregates";
import { clusterFigures, deliveryDenominator, hasDelivery, provinceCount } from "-/lib/figures";
import { CLASS_KINDS, STREAMS, TOTAL_SESSIONS_PER_SCHOOL } from "@sugt/domain";
import type { Metadata } from "next";

/**
 * **Program — the scope of the Programme in full.**
 *
 * Where Beranda leads with four figures, Program lays out the whole scope: the counts, the four
 * Clusters with their Topic and Problem, and every School. Delivery is the same conditional band as
 * elsewhere — it appears only once there is delivery, and never as a per-School figure (ADR-0001).
 */
export const metadata: Metadata = { title: "Program" };

export const revalidate = 3600;

export default async function Page() {
  const [scope, delivery] = await Promise.all([getScope(), getDelivery()]);
  const clusters = clusterFigures(scope, delivery);

  return (
    <>
      <Band className="py-16">
        <h1 className="font-heading text-4xl font-bold tracking-tight">Program</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Cakupan Sekolah Unggul Garuda Transformasi — STEM &amp; Research Track: Sekolah yang ikut,
          Cluster yang menggarapnya, dan bentuk penyelenggaraannya.
        </p>
      </Band>

      <Band>
        <div className="flex flex-wrap gap-x-12 gap-y-8">
          <Stat
            figure={scope.schools.length.toLocaleString("id-ID")}
            caption="Sekolah"
          />
          <Stat
            figure={provinceCount(scope.schools).toLocaleString("id-ID")}
            caption="Provinsi"
          />
          <Stat
            figure={scope.clusters.length}
            caption="Cluster"
          />
          <Stat
            figure={STREAMS.length}
            caption="Stream"
          />
          <Stat
            figure={CLASS_KINDS.length}
            caption="Kelas per Sekolah"
          />
          <Stat
            figure={TOTAL_SESSIONS_PER_SCHOOL}
            caption="Sesi per Sekolah"
          />
        </div>
      </Band>

      <Band>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">Cluster</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
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

      <Band>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">Sekolah</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {scope.schools.length.toLocaleString("id-ID")} Sekolah, urut menurut nama.
        </p>
        <div className="mt-4">
          <SchoolList schools={scope.schools} />
        </div>
      </Band>

      {hasDelivery(delivery) && (
        <DeliveryBand
          deliveredTotal={delivery.deliveredTotal}
          denominator={deliveryDenominator(scope.schools.length)}
          clusters={clusters.map(({ cluster, delivered }) => ({ name: cluster.name, delivered }))}
        />
      )}
    </>
  );
}
