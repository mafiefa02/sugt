"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@sugt/ui/components/tooltip";
import { CloudOff } from "lucide-react";

/**
 * **A quiet mark on something recorded but not yet in place in Drive** (ADR-0040, #375) — a
 * transaction's receipts, or a Perjadin Document (ADR-0042): the reconcile has not finished. Small
 * and muted — nothing is wrong with the record, and nothing is asked of whoever reads it; an
 * Administrator's Periksa koneksi finishes it. `explanation` is in the tooltip for a pointer, and
 * spoken in full from an `sr-only` span for a screen reader. The trigger is a real button, so the
 * tooltip opens on keyboard focus.
 */
function UnsyncedMarker({ explanation }: { explanation: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
          />
        }
      >
        <CloudOff
          aria-hidden
          className="size-3.5"
        />
        <span aria-hidden>belum tersinkron</span>
        <span className="sr-only">{explanation}</span>
      </TooltipTrigger>
      <TooltipContent>{explanation}</TooltipContent>
    </Tooltip>
  );
}

export { UnsyncedMarker };
