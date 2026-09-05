"use client";

import { togglePreparationItemAction } from "-/app/(app)/perjadin/[id]/actions";
import type { PreparationItem } from "@sugt/db/queries";
import { Checkbox } from "@sugt/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@sugt/ui/components/dialog";
import { type ReactElement, useId, useOptimistic, useTransition } from "react";

/**
 * The Preparation Checklist — a private, hand-ticked pre-departure to-do list
 * ([#114](https://github.com/mafiefa02/sugt/issues/114)).
 *
 * **An internal-monitoring aid, and nothing more**: no money, no deadline, not a record, and
 * nothing ever ticks a box automatically. The six fixed items and one per Teaching Team member
 * are derived server-side (`perjadinDetail`); this only flips them.
 *
 * Each box is **optimistic**: it flips on click, fires the toggle action, and reconciles when the
 * route revalidates. Toggling is offered to Staff only — `togglePreparationItem` re-checks the
 * role, so a professor's page renders the boxes read-only rather than trusting the client.
 *
 * **The list lives in one place, `PreparationChecklist`**, so the two ways it is shown — the inline
 * section on the edit page and the dashboard-card dialog — share the very same optimistic toggle
 * rather than forking it. A stray box ticked in the dialog and the same box on the section behind it
 * would drift apart if each held its own state; one component makes that impossible.
 */
function PreparationChecklist({
  perjadinId,
  items,
  canToggle,
}: {
  perjadinId: string;
  items: PreparationItem[];
  canToggle: boolean;
}) {
  const [optimisticItems, setOptimisticChecked] = useOptimistic(
    items,
    (state, patch: { itemKey: string; checked: boolean }) =>
      state.map((item) =>
        item.itemKey === patch.itemKey ? { ...item, checked: patch.checked } : item,
      ),
  );
  const [, startToggle] = useTransition();
  const fields = useId();

  function toggle(itemKey: string, checked: boolean) {
    startToggle(async () => {
      // Inside the transition so the flip and the pending state are one update, then the action —
      // its `revalidatePath` re-reads the real state and `useOptimistic` falls back to it.
      setOptimisticChecked({ itemKey, checked });
      await togglePreparationItemAction(perjadinId, itemKey, checked);
    });
  }

  return (
    <ul className="mt-2.5 space-y-1.5">
      {optimisticItems.map((item) => {
        const id = `${fields}-${item.itemKey}`;
        return (
          <li
            key={item.itemKey}
            className="flex items-center gap-2.5 text-sm"
          >
            <Checkbox
              id={id}
              checked={item.checked}
              disabled={!canToggle}
              onCheckedChange={(checked) => {
                toggle(item.itemKey, checked === true);
              }}
            />
            <label
              htmlFor={id}
              className={canToggle ? "cursor-pointer" : undefined}
            >
              {item.label}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The inline section on the Perjadin edit page — the framed block with its heading and `done/total`
 * count, wrapping the shared `PreparationChecklist`. The count is derived from `items` here in the
 * header; the list's own optimistic flips still reconcile against the same server state, so the two
 * stay in step across a revalidate.
 */
function PerjadinPreparation({
  perjadinId,
  items,
  canToggle,
}: {
  perjadinId: string;
  items: PreparationItem[];
  canToggle: boolean;
}) {
  const done = items.filter((item) => item.checked).length;
  const total = items.length;

  return (
    <div className="border-b border-border px-7 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-sm font-medium">Persiapan</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {done}/{total}
        </span>
      </div>

      <PreparationChecklist
        perjadinId={perjadinId}
        items={items}
        canToggle={canToggle}
      />
    </div>
  );
}

/**
 * The same checklist as a dialog, opened from a caller's own control — the dashboard card's
 * "Persiapan n/7" pill. `trigger` is required because there is no default surface for it here; the
 * pill is the whole reason this variant exists. Live check/uncheck runs through the shared
 * `PreparationChecklist`, so a box ticked in the dialog is the identical optimistic path as the
 * inline section — the toggle is not forked.
 */
function PerjadinPreparationDialog({
  perjadinId,
  items,
  canToggle,
  trigger,
}: {
  perjadinId: string;
  items: PreparationItem[];
  canToggle: boolean;
  trigger: ReactElement;
}) {
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Persiapan</DialogTitle>
        </DialogHeader>

        <PreparationChecklist
          perjadinId={perjadinId}
          items={items}
          canToggle={canToggle}
        />
      </DialogContent>
    </Dialog>
  );
}

export { PerjadinPreparation, PerjadinPreparationDialog };
