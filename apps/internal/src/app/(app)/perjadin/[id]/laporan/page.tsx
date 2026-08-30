import { AcquittalReceipts } from "-/components/laporan-perjadin/acquittal-receipts";
import { AcquittalTransactions } from "-/components/laporan-perjadin/acquittal-transactions";
import { FilePerjadinReport } from "-/components/laporan-perjadin/file-perjadin-report";
import { shortenKabupaten } from "-/lib/format-destination";
import { requirePerson } from "-/lib/person";
import { signedReceiptUrl } from "-/lib/receipt-media";
import { staffSurface } from "-/lib/staff-surface";
import { perjadinAcquittal, type AcquittalTransaction } from "@sugt/db/queries";
import { formatIdr } from "@sugt/domain";
import { LinkButton } from "@sugt/ui/components/link-button";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { ViewableTransaction } from "./action-types";

/**
 * **The Perjadin Report** — the acquittal of one trip, and the screen ADR-0007 says the whole
 * money side of this tool stands or falls on.
 *
 * **Staff-only at every level, and the guard is the read.** `perjadinAcquittal` opens with the
 * choke point, so a Teaching Team member reaching this URL is refused by the query rather than by
 * anything on this page — `staffSurface` turns that refusal into a 403 server-side. There is no
 * money in any props object here that a non-Staff caller could have received, because the payload
 * was never produced for them.
 *
 * It is a child of `/perjadin/[id]` rather than a top-level surface because the Perjadin Report
 * *is* the acquittal state on that Perjadin's row — `data-model.md` is explicit that there is no
 * `perjadin_report` table. Issue #30 owned the slug question and this is the answer: the placeholder
 * at `/laporan-perjadin` is gone, and with it the sidebar entry that pointed at it, because a
 * top-level link would have needed an index of trips that nothing asked for.
 *
 * **Three figures on it are derived and none is stored** — the remainder, the deadline and the days
 * left. Nothing is gated on the deadline: DITSAMA sets it for itself.
 */
export default async function Page({ params }: PageProps<"/perjadin/[id]/laporan">) {
  const person = await requirePerson();
  const { id } = await params;

  const acquittal = await staffSurface(() => perjadinAcquittal(person, id));
  if (!acquittal) notFound();

  const transactions = await Promise.all(acquittal.transactions.map(viewable));

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border px-7 py-5">
        <Link
          href={`/perjadin/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          {shortenKabupaten(acquittal.destination)}
        </Link>
        <h1 className="mt-1 font-heading text-lg font-medium">Laporan Perjadin</h1>
        <p className="text-sm text-muted-foreground tabular-nums">
          {acquittal.startsOn} – {acquittal.endsOn}
        </p>
      </header>

      <div className="border-b border-border px-7 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-sm font-medium">Uang muka</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Jatuh tempo <span className="tabular-nums">{acquittal.reportDueOn}</span> ·{" "}
              <Deadline daysRemaining={acquittal.daysRemaining} />
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/*
              A Route Handler rather than a Server Action: the response is a file with its own
              content type and `Content-Disposition`, which an action cannot set.
            */}
            <LinkButton
              href={`/perjadin/${id}/laporan/ekspor`}
              variant="outline"
              size="sm"
            >
              Ekspor rincian
            </LinkButton>
            <FilePerjadinReport
              perjadinId={id}
              filedAt={acquittal.reportFiledAt}
            />
          </div>
        </div>

        <dl className="mt-2.5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <Figure
            label="Diterima"
            amountIdr={acquittal.advanceIdr}
          />
          <Figure
            label="Terpakai"
            amountIdr={acquittal.spentIdr}
          />
          {/*
            Derived and never stored: the Advance less every transaction against it. Negative
            means the Group overspent, which is a real state and not an error.
          */}
          <Figure
            label="Sisa"
            amountIdr={acquittal.remainderIdr}
          />
        </dl>
      </div>

      {acquittal.pimpinan.length > 0 && (
        <section className="border-b border-border px-7 py-5">
          <h2 className="font-heading text-sm font-medium">Pimpinan yang turut serta</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
            {acquittal.pimpinan.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </section>
      )}

      <AcquittalTransactions
        perjadinId={id}
        transactions={transactions}
        group={acquittal.receipts}
      />

      <AcquittalReceipts
        perjadinId={id}
        receipts={acquittal.receipts}
      />
    </div>
  );
}

/**
 * One line item with a link per receipt.
 *
 * The `receipts` bucket is private, so a receipt renders only through a signed URL, and signing is
 * a network call per object. It happens here — after `perjadinAcquittal` has already refused a
 * non-Staff caller — so the Staff check stays at one choke point and this page never decides
 * anything about access on its own. A `null` URL is an object whose bytes are gone, which renders
 * as a missing file rather than a broken page.
 */
async function viewable(line: AcquittalTransaction): Promise<ViewableTransaction> {
  const evidence = await Promise.all(
    line.evidence.map(async (file) => ({
      id: file.id,
      contentType: file.contentType,
      byteSize: file.byteSize,
      url: await signedReceiptUrl(file.storagePath),
    })),
  );
  return { ...line, evidence };
}

/**
 * Days left against the deadline. **Nothing is gated on it** — DITSAMA sets that deadline itself,
 * and the tool is never stricter than the process it serves — so a passed deadline is stated and
 * not enforced.
 */
function Deadline({ daysRemaining }: { daysRemaining: number }) {
  if (daysRemaining < 0) {
    return <span className="text-destructive">terlambat {Math.abs(daysRemaining)} hari</span>;
  }
  return <span className="tabular-nums">sisa {daysRemaining} hari</span>;
}

/**
 * Money in whole rupiah, which is what it is stored as — `numeric(_, 2)` would imply a subunit
 * nobody uses, so there is no cent to render and none is invented here.
 */
function Figure({ label, amountIdr }: { label: string; amountIdr: number }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">Rp {formatIdr(amountIdr)}</dd>
    </div>
  );
}
