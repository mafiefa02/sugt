"use client";

import { filePerjadinReportAction } from "-/app/(app)/perjadin/[id]/laporan/actions";
import { Alert, AlertDescription, AlertTitle } from "@sugt/ui/components/alert";
import { Button } from "@sugt/ui/components/button";
import { useState, useTransition } from "react";

/**
 * **Filing the Perjadin Report.**
 *
 * Named in full, never as "Report": `CONTEXT.md` reserves the unqualified word, because a
 * Perjadin Report is the acquittal and the tool holds several other things a reader would
 * otherwise call a report.
 *
 * This is the one moment "every transaction has at least one piece of evidence" is checked. It is
 * a cross-row count no constraint can express, and it must not run when a transaction is entered:
 * a receipt may be attached later, and a PIC logging a fare on the pavement has not photographed
 * it yet.
 *
 * **Nothing else is gated**, the deadline included. DITSAMA sets that deadline for itself, and the
 * tool is never stricter than the process it serves — invented friction has the same escape route
 * as duplicated work.
 */
function FilePerjadinReport({ perjadinId, filedAt }: { perjadinId: string; filedAt: Date | null }) {
  const [refusal, setRefusal] = useState<{ title: string; body: string } | null>(null);
  const [filing, startFiling] = useTransition();

  if (filedAt !== null) {
    return (
      <span className="text-sm text-muted-foreground">
        Dilaporkan <span className="tabular-nums">{filedAt.toISOString().slice(0, 10)}</span>
      </span>
    );
  }

  function file() {
    startFiling(async () => {
      setRefusal(null);
      const result = await filePerjadinReportAction(perjadinId);
      // Every arm of the union is answered. Two of them describe a page that has gone stale
      // rather than anything the PIC did, and a button that does nothing visible on either
      // is worse than one that says which.
      switch (result.outcome) {
        case "filed":
          return;
        case "evidence-missing":
          // The count, rather than the ids: the rows are on the screen below and marked
          // "Belum ada bukti" already, so naming how many is what this adds.
          setRefusal({
            title: "Laporan belum bisa dikirim.",
            body: `${result.transactionIds.length} transaksi belum punya bukti. Lampirkan bukti pada setiap transaksi terlebih dahulu.`,
          });
          return;
        case "already-filed":
          setRefusal({
            title: "Laporan ini sudah dikirim.",
            body: `Dilaporkan ${result.filedAt.toISOString().slice(0, 10)}. Muat ulang halaman untuk melihat keadaannya.`,
          });
          return;
        case "no-such-perjadin":
          setRefusal({
            title: "Perjadin ini sudah tidak ada.",
            body: "Muat ulang halaman untuk melihat keadaannya.",
          });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        size="sm"
        disabled={filing}
        onClick={file}
      >
        {filing ? "Melaporkan…" : "Laporkan"}
      </Button>
      {refusal !== null && (
        <Alert variant="destructive">
          <AlertTitle>{refusal.title}</AlertTitle>
          <AlertDescription>{refusal.body}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export { FilePerjadinReport };
