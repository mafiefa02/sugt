import * as React from "react";

/**
 * Surface container for grouped content — the workhorse of the internal tool's
 * screens (coverage tiles, a Session Record, the acquittal panel). Rounded
 * corners, 1px border, no shadow.
 *
 * Intentional addition: not present in the source repo (apps are placeholders),
 * styled to the established base-rhea vocabulary.
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional header title. */
  title?: React.ReactNode;
  /** Optional muted sub-line under the title. */
  description?: React.ReactNode;
  /** Optional footer row (actions). */
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

export function Card(props: CardProps): React.ReactElement;
