import { formatRupiah } from "@sugt/domain";

/**
 * **One money figure on the Uang Perjalanan strip** — `/perjadin/[id]` and its Laporan render the
 * same Diterima / Terpakai / Sisa, so they share this.
 *
 * `null` is a figure that cannot be given yet: Uang Perjalanan not filled in, and so no Sisa (#437).
 * It reads `unset` ("—" unless named), never "Rp 0", "NaN" or a negative.
 *
 * Money in whole rupiah, which is what it is stored as — `numeric(_, 2)` would imply a subunit nobody
 * uses, so there is no cent to render and none is invented here.
 */
function MoneyFigure({
  label,
  amountIdr,
  unset = "—",
}: {
  label: string;
  amountIdr: number | null;
  unset?: string;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{amountIdr === null ? unset : formatRupiah(amountIdr)}</dd>
    </div>
  );
}

export { MoneyFigure };
