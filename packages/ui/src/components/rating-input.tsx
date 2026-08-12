"use client";

import type { RatingBounds } from "@sugt/ui/components/rating";
import { cn } from "@sugt/ui/lib/utils";

/**
 * The control that files a Rating: one cell per point on the scale, one of them picked.
 *
 * Native radios rather than buttons, so the control needs no state of its own, arrow
 * keys work, and a `<form>` posts the value without JavaScript. Pass `value` and
 * `onValueChange` to drive it from a form library instead; pass neither and
 * `defaultValue` leaves it uncontrolled.
 *
 * The bounds arrive as props with no defaults, for the reason `RatingBounds` gives.
 * The cells are `max - min + 1`, and which of them read as a concern follows from
 * `concernAtOrBelow` — nothing here knows that the scale runs 1 to 10.
 *
 * `sm` is for the Participant Feedback form, which is filled on a phone in a classroom
 * rather than at a desk. It is a prop rather than a breakpoint because the surface is
 * phone-first, not a desktop form at a small viewport. It is a `size` and not a
 * `variant`, because `Rating`'s `variant="compact"` means something else entirely —
 * that one drops the meter, where this one shrinks the cell.
 */
function RatingInput({
  name,
  min,
  max,
  concernAtOrBelow,
  value,
  defaultValue,
  onValueChange,
  size = "default",
  disabled,
  className,
  ...props
}: RatingBounds & {
  name: string;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  size?: "default" | "sm";
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const controlled = value !== undefined;

  return (
    <div
      data-slot="rating-input"
      data-size={size}
      role="radiogroup"
      className={cn("flex", size === "sm" ? "gap-[3px]" : "gap-1", className)}
      {...props}
    >
      {Array.from({ length: max - min + 1 }, (_, index) => {
        const cell = min + index;
        /* A cell knows at render time which fill it takes once picked, so the concern
           colour is a class rather than a re-render. Below the threshold the fill is
           solid `--destructive` with white text — a filled cell states a choice, where
           the compact chip on the read-only Rating tints instead. */
        const concern = cell <= concernAtOrBelow;
        return (
          <label
            key={cell}
            className="cursor-pointer"
          >
            <input
              type="radio"
              name={name}
              value={cell}
              disabled={disabled}
              className="peer sr-only"
              {...(controlled
                ? { checked: value === cell }
                : { defaultChecked: defaultValue === cell })}
              onChange={() => onValueChange?.(cell)}
            />
            <span
              className={cn(
                "flex items-center justify-center rounded-md border border-border bg-card font-medium text-muted-foreground tabular-nums transition-all select-none hover:bg-muted active:translate-y-px",
                size === "sm" ? "size-[23px] text-[11px]" : "size-7 text-xs",
                "peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/30",
                "peer-disabled:pointer-events-none peer-disabled:opacity-50",
                concern
                  ? "peer-checked:border-destructive peer-checked:bg-destructive peer-checked:text-white"
                  : "peer-checked:border-foreground peer-checked:bg-foreground peer-checked:text-background",
              )}
            >
              {cell}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export { RatingInput };
