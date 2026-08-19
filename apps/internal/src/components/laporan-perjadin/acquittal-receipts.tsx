"use client";

import { markReceiptsSettledAction } from "-/app/(app)/perjadin/[id]/laporan/actions";
import type { AcquittalReceipt } from "@sugt/db/queries";
import { ROLE_LABELS } from "@sugt/domain";
import { Checkbox } from "@sugt/ui/components/checkbox";
import { Label } from "@sugt/ui/components/label";
import { useId, useState, useTransition } from "react";

/**
 * **The receipts checklist** — who on the Group has handed their receipts over.
 *
 * The tool does not collect receipts from Group members; they reach the PIC however they reach
 * them today. What it does is track who is still outstanding, so the PIC has a checklist rather
 * than a memory.
 *
 * **The tick is an explicit mark and never derived.** A member with no transactions is genuinely
 * ambiguous between *spent nothing* and *has not handed anything over yet*, and counting their
 * transactions would answer the second question with the first question's evidence.
 */
function AcquittalReceipts({
  perjadinId,
  receipts,
}: {
  perjadinId: string;
  receipts: AcquittalReceipt[];
}) {
  return (
    <div className="px-7 py-5">
      <h2 className="font-heading text-sm font-medium">Bukti dari anggota Group</h2>
      <ul className="mt-2.5 space-y-2">
        {receipts.map((member) => (
          <SettledMark
            key={member.personId}
            perjadinId={perjadinId}
            member={member}
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * One member's mark.
 *
 * The checkbox holds its own state rather than waiting for the page to revalidate, so a PIC
 * working down a list of four does not watch each tick round-trip. A refusal puts it back — the
 * only one reachable is a member who left the Group in another tab.
 */
function SettledMark({ perjadinId, member }: { perjadinId: string; member: AcquittalReceipt }) {
  const [settled, setSettled] = useState(member.settledAt !== null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const field = useId();

  function toggle(next: boolean) {
    setSettled(next);
    setRefusal(null);
    startSaving(async () => {
      const result = await markReceiptsSettledAction(perjadinId, member.personId, next);
      if (result.outcome === "no-such-member") {
        setSettled(!next);
        setRefusal("Orang ini sudah bukan anggota Group. Muat ulang halaman.");
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <Checkbox
        id={field}
        checked={settled}
        disabled={saving}
        onCheckedChange={(checked) => {
          toggle(checked === true);
        }}
      />
      <Label htmlFor={field}>{member.fullName}</Label>
      {/*
        Staff carry no Stream and Teaching Team always carry one, so the role is what
        distinguishes members here. Shown through `ROLE_LABELS` like every other role render
        (#116), so a Staff member reads "DITSAMA" — the same label the Group list gives them.
      */}
      <span className="text-muted-foreground">{ROLE_LABELS[member.role]}</span>
      {refusal !== null && <span className="text-destructive">{refusal}</span>}
    </li>
  );
}

export { AcquittalReceipts };
