import React from "react";

/* SUGT Badge — compact status / count pill (rounded, like everything else).
   Intentional addition. The palette has no green or amber, so the "how it went"
   scale is expressed within the red ramp: on-track reads as calm neutral,
   some-concerns as a soft red tint (chart-1), struggling as full destructive. */

const CSS = `
.sugt-badge{display:inline-flex;align-items:center;gap:var(--space-1);font-family:var(--font-sans);
  font-weight:var(--weight-medium);font-size:var(--text-xs);line-height:1;padding:3px var(--space-2);
  border:var(--border-width) solid transparent;border-radius:var(--radius-md);white-space:nowrap}
.sugt-badge svg{width:12px;height:12px}
.sugt-badge[data-variant="default"]{background:var(--secondary);color:var(--secondary-foreground)}
.sugt-badge[data-variant="primary"]{background:var(--primary);color:var(--primary-foreground)}
.sugt-badge[data-variant="outline"]{border-color:var(--border);color:var(--foreground);background:transparent}
.sugt-badge[data-variant="ontrack"]{background:var(--muted);color:var(--muted-foreground)}
.sugt-badge[data-variant="concern"]{background:color-mix(in oklch,var(--chart-1),transparent 78%);
  color:var(--chart-5);border-color:color-mix(in oklch,var(--chart-1),transparent 55%)}
.sugt-badge[data-variant="struggling"]{background:color-mix(in oklch,var(--destructive),transparent 88%);
  color:var(--destructive);border-color:color-mix(in oklch,var(--destructive),transparent 65%)}
`;

function inject() {
  if (typeof document === "undefined" || document.getElementById("sugt-badge-css")) return;
  const el = document.createElement("style");
  el.id = "sugt-badge-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function Badge({ variant = "default", className = "", children, ...props }) {
  inject();
  return (
    <span className={`sugt-badge ${className}`.trim()} data-variant={variant} {...props}>
      {children}
    </span>
  );
}

export { CSS as badgeCss };
