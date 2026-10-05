"use client";

import type { DriveCheckReport } from "-/lib/drive/check";
import { describeDriveCheck } from "-/lib/drive/check-report";
import { Alert, AlertDescription } from "@sugt/ui/components/alert";
import { Button } from "@sugt/ui/components/button";
import { useState, useTransition } from "react";

import { checkDriveConnectionAction } from "./actions";

/**
 * **[Periksa koneksi]** on the Terhubung card (#375), and what it found. `children` are the card's
 * other actions — Hubungkan ulang — kept on the same row as the button; the report reads beneath
 * them, warnings first, since a folder anyone can open is the finding that matters most.
 */
function PeriksaKoneksi({ children }: { children?: React.ReactNode }) {
  const [report, setReport] = useState<DriveCheckReport | null>(null);
  const [checking, startChecking] = useTransition();
  const said = report ? describeDriveCheck(report) : null;

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={checking}
          onClick={() => {
            startChecking(async () => {
              setReport(await checkDriveConnectionAction());
            });
          }}
        >
          {checking ? "Memeriksa…" : "Periksa koneksi"}
        </Button>
        {children}
      </div>

      {said && (
        <div className="flex flex-col gap-2 text-sm">
          {said.warnings.map((warning) => (
            <Alert
              key={warning}
              variant="destructive"
            >
              <AlertDescription>{warning}</AlertDescription>
            </Alert>
          ))}
          <ul className="flex flex-col gap-1">
            {said.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {said.failures.length > 0 && (
            <ul className="flex flex-col gap-1 text-muted-foreground">
              {said.failures.map((failure) => (
                <li key={failure}>{failure}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export { PeriksaKoneksi };
