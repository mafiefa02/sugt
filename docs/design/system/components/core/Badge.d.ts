import * as React from "react";

/**
 * Compact status / count pill. Carries the "how it went" scale that feeds the
 * concerns list — expressed within SUGT's red-only palette.
 *
 * Intentional addition: not in the source repo; styled to base-rhea.
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * `ontrack` / `concern` / `struggling` map to the Session Record "how it went"
   * pick; `default` / `primary` / `outline` are generic.
   */
  variant?: "default" | "primary" | "outline" | "ontrack" | "concern" | "struggling";
  children?: React.ReactNode;
}

export function Badge(props: BadgeProps): React.ReactElement;
