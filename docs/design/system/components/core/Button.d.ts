import * as React from "react";

/**
 * SUGT primary action control. Base UI button + cva variants, rounded corners,
 * Montserrat medium. Mirrors packages/ui/src/components/button.tsx exactly.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. */
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  /** Control height / padding. `icon*` sizes are square. */
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
  className?: string;
  children?: React.ReactNode;
}

export function Button(props: ButtonProps): React.ReactElement;
