"use client";

import { togglePreparationItemAction } from "-/app/(app)/perjadin/[id]/actions";
import type { PreparationItem } from "@sugt/db/queries";
import { Checkbox } from "@sugt/ui/components/checkbox";
import { useId, useOptimistic, useTransition } from "react";

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
  const [optimisticItems, setOptimisticChecked] = useOptimistic(
    items,
    (state, patch: { itemKey: string; checked: boolean }) =>
      state.map((item) =>
        item.itemKey === patch.itemKey ? { ...item, checked: patch.checked } : item,
      ),
  );
  const [, startToggle] = useTransition();
  const fields = useId();

  const done = optimisticItems.filter((item) => item.checked).length;
  const total = optimisticItems.length;

  function toggle(itemKey: string, checked: boolean) {
    startToggle(async () => {
      // Inside the transition so the flip and the pending state are one update, then the action —
      // its `revalidatePath` re-reads the real state and `useOptimistic` falls back to it.
      setOptimisticChecked({ itemKey, checked });
      await togglePreparationItemAction(perjadinId, itemKey, checked);
    });
  }

  return (
    <div className="border-b border-border px-7 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-sm font-medium">Persiapan</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {done}/{total}
        </span>
      </div>

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
    </div>
  );
}

export { PerjadinPreparation };
