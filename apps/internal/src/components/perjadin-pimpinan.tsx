"use client";

import { setPerjadinPimpinanAction } from "-/app/(app)/perjadin/[id]/actions";
import { PIMPINAN } from "@sugt/domain";
import { Checkbox } from "@sugt/ui/components/checkbox";
import { Label } from "@sugt/ui/components/label";
import { useId, useState, useTransition } from "react";

/**
 * The Pimpinan recorded on a trip — a subset of the fixed three (ADR-0020). Record-only: a Pimpinan
 * is not a Group member, files no Evaluation and adds nothing to the Preparation Checklist, so this
 * is a plain checkbox editor and nothing more.
 *
 * Staff toggle the set; each toggle writes the whole set. A professor sees the recorded names
 * read-only.
 */
function PerjadinPimpinan({
  perjadinId,
  pimpinan,
  canEdit,
}: {
  perjadinId: string;
  pimpinan: string[];
  canEdit: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(pimpinan);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const idPrefix = useId();

  function toggle(name: string, checked: boolean) {
    const next = checked ? [...selected, name] : selected.filter((entry) => entry !== name);
    const previous = selected;
    setSelected(next);
    setRefusal(null);
    startSaving(async () => {
      const result = await setPerjadinPimpinanAction(perjadinId, next);
      if (result.outcome !== "set") {
        setSelected(previous);
        setRefusal("Perubahan gagal. Muat ulang halaman untuk melihat keadaannya.");
      }
    });
  }

  return (
    <div className="border-b border-border px-7 py-5">
      <h2 className="font-heading text-sm font-medium">Pimpinan</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pimpinan DITSAMA yang ikut memantau — tercatat saja, bukan anggota Group.
      </p>

      {refusal !== null && <p className="mt-2 text-sm text-destructive">{refusal}</p>}

      {canEdit ? (
        <ul className="mt-3 grid gap-2">
          {PIMPINAN.map((name) => {
            const checkboxId = `${idPrefix}-${name}`;
            return (
              <li
                key={name}
                className="flex items-center gap-2.5"
              >
                <Checkbox
                  id={checkboxId}
                  checked={selected.includes(name)}
                  disabled={saving}
                  onCheckedChange={(checked) => {
                    toggle(name, checked === true);
                  }}
                />
                <Label
                  htmlFor={checkboxId}
                  className="text-sm font-normal"
                >
                  {name}
                </Label>
              </li>
            );
          })}
        </ul>
      ) : selected.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm">
          {selected.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Tidak ada.</p>
      )}
    </div>
  );
}

export { PerjadinPimpinan };
