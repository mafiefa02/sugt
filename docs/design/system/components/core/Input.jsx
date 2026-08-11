import React from "react";

/* SUGT Input — text field. Intentional addition, styled to base-rhea:
   1px --input border, rounded corners, h-8, px-3, text-sm, 3px focus ring. */

const CSS = `
.sugt-input{display:flex;width:100%;height:var(--control-h);padding-inline:var(--space-3);
  font-family:var(--font-sans);font-size:var(--text-sm);color:var(--foreground);background:var(--background);
  border:var(--border-width) solid var(--input);border-radius:var(--radius-lg);outline:none;
  transition:border-color .15s ease,box-shadow .15s ease}
.sugt-input::placeholder{color:var(--muted-foreground)}
.sugt-input:focus-visible{border-color:var(--ring);box-shadow:0 0 0 var(--ring-width) var(--ring-color)}
.sugt-input[disabled]{opacity:.5;pointer-events:none}
.sugt-input[aria-invalid="true"]{border-color:var(--destructive);
  box-shadow:0 0 0 var(--ring-width) color-mix(in oklch,var(--destructive),transparent 80%)}
textarea.sugt-input{height:auto;min-height:calc(var(--control-h) * 2.5);padding-block:var(--space-2);
  line-height:var(--leading-normal);resize:vertical}
`;

function inject() {
  if (typeof document === "undefined" || document.getElementById("sugt-input-css")) return;
  const el = document.createElement("style");
  el.id = "sugt-input-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function Input({ as = "input", className = "", ...props }) {
  inject();
  const Tag = as === "textarea" ? "textarea" : "input";
  return <Tag className={`sugt-input ${className}`.trim()} {...props} />;
}

export { CSS as inputCss };
