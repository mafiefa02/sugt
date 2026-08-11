import * as React from "react";

/**
 * Text field for the internal tool's forms (Perjadin creation, acquittal
 * transactions, Session Record prose). Set `as="textarea"` for multi-line prose.
 *
 * Intentional addition: not in the source repo; styled to base-rhea.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Render an `<input>` (default) or a `<textarea>`. */
  as?: "input" | "textarea";
}

export function Input(props: InputProps): React.ReactElement;
