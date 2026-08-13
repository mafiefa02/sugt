"use client";

import { filePerjadinReportAction } from "-/app/(app)/perjadin/[id]/laporan/actions";
import { Alert, AlertDescription, AlertTitle } from "@sugt/ui/components/alert";
import { Button } from "@sugt/ui/components/button";
import { useState, useTransition } from "react";

/**
 * **Filing the Report.**
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
function FileReport({ perjadinId, filedAt }: { perjadinId: string; filedAt: Date | null }) {
  const [missing, setMissing] = useState<number | null>(null);
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
      setMissing(null);
      const result = await filePerjadinReportAction(perjadinId);
      // The count, rather than the ids: the rows are on the screen below and marked
      // "Belum ada bukti" already, so naming how many is what this adds.
      if (result.outcome === "evidence-missing") setMissing(result.transactionIds.length);
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
      {missing !== null && (
        <Alert variant="destructive">
          <AlertTitle>Laporan belum bisa dikirim.</AlertTitle>
          <AlertDescription>
            {missing} transaksi belum punya bukti. Lampirkan bukti pada setiap transaksi terlebih
            dahulu.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export { FileReport };
