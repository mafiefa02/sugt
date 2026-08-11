import * as React from "react";

/**
 * Compact status / count pill — labels, counts, Session status.
 *
 * It no longer carries a severity scale. The "how it went" pick it was built for
 * is gone; the outcome signal is a 1–10 Rating against a named Aspect, and that
 * has its own component. Reach for `Rating`, not a coloured Badge.
 *
 * Intentional addition: not in the source repo; styled to base-rhea.
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * All generic. `muted` is the quietest, for counts and secondary labels;
   * `primary` fills with brand red and should stay rare.
   */
  variant?: "default" | "primary" | "outline" | "muted";
  children?: React.ReactNode;
}

export function Badge(props: BadgeProps): React.ReactElement;
