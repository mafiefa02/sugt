import React from "react";

/* SUGT Badge — compact status / count pill (rounded, like everything else).
   Intentional addition.

   Badge used to carry the "how it went" scale — ontrack / concern / struggling.
   That pick no longer exists: the signal is now a 1–10 Rating against a named
   Aspect. Those three variants are gone rather than renamed, because a pill
   reading "4" is a label pretending to be a measurement. Use <Rating>. */

const CSS = `
.sugt-badge{display:inline-flex;align-items:center;gap:var(--space-1);font-family:var(--font-sans);
  font-weight:var(--weight-medium);font-size:var(--text-xs);line-height:1;padding:3px var(--space-2);
  border:var(--border-width) solid transparent;border-radius:var(--radius-md);white-space:nowrap}
.sugt-badge svg{width:12px;height:12px}
.sugt-badge[data-variant="default"]{background:var(--secondary);color:var(--secondary-foreground)}
.sugt-badge[data-variant="primary"]{background:var(--primary);color:var(--primary-foreground)}
.sugt-badge[data-variant="outline"]{border-color:var(--border);color:var(--foreground);background:transparent}
.sugt-badge[data-variant="muted"]{background:var(--muted);color:var(--muted-foreground)}
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
