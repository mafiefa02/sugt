import { Band } from "-/components/band";
import { Stat } from "-/components/stat";
import { Progress } from "@sugt/ui/components/progress";

/**
 * **The delivery band — figures that accrue, shown only once there are any.**
 *
 * The caller renders this **only when `deliveredTotal > 0`** (`figures.hasDelivery`), so it never
 * appears at `0 Sesi terlaksana` — the screen ADR-0001 calls worse than publishing nothing. Every
 * figure here is delivery, never scope; the two are kept apart deliberately. `denominator` and the
 * per-Cluster figures are derived by the caller from the payloads, so nothing here can disagree with
 * the numbers beside it.
 */
function DeliveryBand({
  deliveredTotal,
  denominator,
  clusters,
}: {
  deliveredTotal: number;
  denominator: number;
  clusters: { name: string; delivered: number }[];
}) {
  const percent = denominator === 0 ? 0 : Math.round((deliveredTotal / denominator) * 100);

  return (
    <Band>
      <h2 className="font-heading text-2xl font-semibold tracking-tight">Yang sudah berjalan</h2>
      <div className="mt-6 flex flex-wrap gap-x-12 gap-y-6">
        <Stat
          figure={deliveredTotal.toLocaleString("id-ID")}
          caption="Sesi terlaksana"
        />
        <Stat
          figure={`${percent}%`}
          caption={`dari ${denominator.toLocaleString("id-ID")} sesi terencana`}
        />
      </div>
      <Progress
        value={percent}
        className="mt-5 max-w-md"
      />

      <dl className="mt-8 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {clusters.map((cluster) => (
          <div
            key={cluster.name}
            className="flex items-baseline justify-between gap-4 border-b border-border pb-2"
          >
            <dt className="text-sm">{cluster.name}</dt>
            <dd className="text-sm font-semibold tabular-nums">{cluster.delivered}</dd>
          </div>
        ))}
      </dl>
    </Band>
  );
}

export { DeliveryBand };
