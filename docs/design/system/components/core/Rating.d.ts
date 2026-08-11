import * as React from "react";

/**
 * A 1–10 Aspect score — the only thing in the system anything counts.
 *
 * Magnitude is carried by the digit and the meter length, never by colour alone.
 * Colour encodes exactly one boundary, the domain's own: at or below 7 an Aspect
 * reaches the concerns list and reads red; 8 and above are quiet grey. Within the
 * concern range the fill deepens continuously from 7 to 1, so severity is visible
 * without inventing categories.
 *
 * Intentional addition: no counterpart in the source repo.
 */
export interface RatingProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** The score, 1–10. `RATING_MIN` / `RATING_MAX` in `@sugt/domain`. */
  value: number;
  /**
   * The Aspect being scored, in Indonesian — `Pemahaman`, `Fasilitas`, `Penginapan`.
   * Optional: omit inside a table whose column header already names it.
   */
  label?: string;
  /**
   * `default` shows label, meter and digit. `compact` drops the meter for dense
   * rows — seven meters on one line is too much ink — keeping the digit and its tint.
   */
  variant?: "default" | "compact";
}

export function Rating(props: RatingProps): React.ReactElement;
