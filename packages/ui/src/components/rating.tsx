import { cn } from "@sugt/ui/lib/utils";

/**
 * The bounds a Rating is read against.
 *
 * `RATING_MIN`, `RATING_MAX` and `CONCERN_AT_OR_BELOW` live in `@sugt/domain`, which
 * this package may not import — AGENTS.md rule 4. So they arrive as props, and there
 * are deliberately **no defaults**. A `10` written here would be a second source of
 * truth for a number that also sits in a CHECK constraint and four index predicates,
 * and a default would let a caller drift from the database with nothing saying so.
 * The cost is verbosity at every call site, and that is what rule 4 is worth.
 *
 * Nothing in this file compares against a literal either: the meter length, the cell
 * count and the severity ramp are all derived from these three numbers.
 */
type RatingBounds = {
  min: number;
  max: number;
  concernAtOrBelow: number;
};

/**
 * How deep into the concern range a value sits: `0` at the threshold, `1` at the floor.
 *
 * Severity is continuous inside the concern range — a 7 is faint, a 1 is solid — with
 * no bands between them. The domain has exactly one threshold, and banding the range
 * into mild/bad/severe would invent two more in the visual layer.
 */
function concernDensity(value: number, min: number, concernAtOrBelow: number) {
  const span = concernAtOrBelow - min;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (concernAtOrBelow - value) / span));
}

/**
 * A Rating: the score one person gave one Aspect, read-only.
 *
 * Three rules, all from the domain rather than from taste:
 *
 * 1. **The digit always shows.** Magnitude is carried by the number and by the length
 *    of the meter, both of which survive without colour. The palette has no green and
 *    no amber, so colour could only ever reinforce.
 * 2. **Colour marks one boundary.** At or below `concernAtOrBelow` the meter is red;
 *    above it, quiet grey. Good is never green — it simply stops being red.
 * 3. **Density is continuous inside the concern range.** See `concernDensity`.
 *
 * `compact` drops the meter for dense rows — the concerns list, a School's Sessions —
 * where one meter per row is too much ink.
 */
function Rating({
  value,
  min,
  max,
  concernAtOrBelow,
  label,
  variant = "default",
  className,
  ...props
}: React.ComponentProps<"span"> &
  RatingBounds & {
    value: number;
    label?: string;
    variant?: "default" | "compact";
  }) {
  const concern = value <= concernAtOrBelow;
  const density = concernDensity(value, min, concernAtOrBelow);
  const lit = value - min + 1;

  return (
    <span
      data-slot="rating"
      data-variant={variant}
      data-tone={concern ? "concern" : "fine"}
      role="img"
      aria-label={`${label ? `${label}: ` : ""}${value} dari ${max}`}
      className={cn(
        "inline-flex items-center leading-none whitespace-nowrap",
        variant === "compact" ? "gap-1.5" : "gap-2",
        className,
      )}
      {...props}
    >
      {label ? <span className="text-xs font-medium text-muted-foreground">{label}</span> : null}
      {variant === "default" ? (
        <span
          className="inline-flex items-center gap-[2px]"
          aria-hidden="true"
        >
          {Array.from({ length: max - min + 1 }, (_, index) => {
            const on = index < lit;
            return (
              <span
                key={index}
                className={cn(
                  "h-3 w-[5px] rounded-[1px] bg-muted",
                  on && (concern ? "bg-destructive" : "bg-muted-foreground opacity-45"),
                )}
                /* The ramp runs 0.55 at the threshold to 1 at the floor. Written as a
                   number rather than a class because it is continuous, and derived from
                   `min` rather than keyed on the value so the bounds stay in one place. */
                style={on && concern ? { opacity: 0.55 + density * 0.45 } : undefined}
              />
            );
          })}
        </span>
      ) : null}
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          variant === "default" && "min-w-[1.25em] text-right",
          variant === "default" && (concern ? "text-destructive" : "text-muted-foreground"),
          variant === "compact" && "rounded-sm border border-transparent px-1.5 py-[2px]",
          variant === "compact" && (concern ? "text-foreground" : "bg-muted text-muted-foreground"),
        )}
        /* The digit on a tinted chip is `--foreground`, **not** `--destructive`. Red text
           on a red tint measures 2.96:1 at the densest chip in light mode, which is below
           AA, and it gets worse as the chip deepens — exactly backwards. `--foreground`
           gives 12.3:1 light and 13.1:1 dark. The chip carries the severity; the number
           stays legible. Don't "fix" this back to a red digit. */
        style={
          variant === "compact" && concern
            ? {
                backgroundColor: `color-mix(in oklch, var(--destructive), transparent ${92 - density * 18}%)`,
                borderColor: "color-mix(in oklch, var(--destructive), transparent 55%)",
              }
            : undefined
        }
      >
        {value}
      </span>
    </span>
  );
}

export { Rating, type RatingBounds };
