import React from "react";

/* SUGT Button — faithful port of packages/ui/src/components/button.tsx
   (Base UI + cva, shadcn "base-rhea"). Tailwind is not present where the design
   system renders its specimens, so the exact class metrics are reproduced as a
   single injected stylesheet keyed off data-attributes. Values are copied 1:1:
   h-8/px-3/text-sm/font-medium, focus ring 3px @ ring/30, active translateY(1px),
   corners rounded via the --radius token. */

const CSS = `
.sugt-btn{--_bd:transparent;display:inline-flex;flex-shrink:0;align-items:center;justify-content:center;
  gap:var(--space-1-5);white-space:nowrap;font-family:var(--font-sans);font-weight:var(--weight-medium);
  font-size:var(--text-sm);line-height:1;border:var(--border-width) solid var(--_bd);
  background-clip:padding-box;border-radius:var(--radius-2xl);cursor:pointer;user-select:none;
  transition:background-color .15s ease,color .15s ease,border-color .15s ease,transform .05s ease;
  outline:none;height:var(--control-h);padding-inline:var(--space-3)}
.sugt-btn svg{width:16px;height:16px;flex-shrink:0;pointer-events:none}
.sugt-btn:focus-visible{border-color:var(--ring);box-shadow:0 0 0 var(--ring-width) var(--ring-color)}
.sugt-btn:active:not([data-haspopup]){transform:translateY(1px)}
.sugt-btn[disabled],.sugt-btn[aria-disabled="true"]{pointer-events:none;opacity:.5}

.sugt-btn[data-variant="default"]{background:var(--primary);color:var(--primary-foreground)}
.sugt-btn[data-variant="default"]:hover{background:color-mix(in oklch,var(--primary),transparent 20%)}
.sugt-btn[data-variant="outline"]{--_bd:var(--border);background:var(--background);color:var(--foreground)}
.sugt-btn[data-variant="outline"]:hover{background:var(--muted)}
.sugt-btn[data-variant="secondary"]{background:var(--secondary);color:var(--secondary-foreground)}
.sugt-btn[data-variant="secondary"]:hover{background:color-mix(in oklch,var(--secondary),var(--foreground) 5%)}
.sugt-btn[data-variant="ghost"]{background:transparent;color:var(--foreground)}
.sugt-btn[data-variant="ghost"]:hover{background:var(--muted)}
.sugt-btn[data-variant="destructive"]{background:color-mix(in oklch,var(--destructive),transparent 90%);color:var(--destructive)}
.sugt-btn[data-variant="destructive"]:hover{background:color-mix(in oklch,var(--destructive),transparent 80%)}
.sugt-btn[data-variant="link"]{background:transparent;color:var(--primary);padding-inline:0;height:auto;border:0}
.sugt-btn[data-variant="link"]:hover{text-decoration:underline;text-underline-offset:4px}

.sugt-btn[data-size="xs"]{height:var(--control-h-xs);gap:var(--space-1);padding-inline:var(--space-2-5);font-size:var(--text-xs)}
.sugt-btn[data-size="xs"] svg{width:12px;height:12px}
.sugt-btn[data-size="sm"]{height:var(--control-h-sm);gap:var(--space-1);padding-inline:var(--space-3)}
.sugt-btn[data-size="lg"]{height:var(--control-h-lg);gap:var(--space-1-5);padding-inline:var(--space-4)}
.sugt-btn[data-size="icon"]{width:var(--control-h);padding:0}
.sugt-btn[data-size="icon-xs"]{width:var(--control-h-xs);height:var(--control-h-xs);padding:0}
.sugt-btn[data-size="icon-xs"] svg{width:12px;height:12px}
.sugt-btn[data-size="icon-sm"]{width:var(--control-h-sm);height:var(--control-h-sm);padding:0}
.sugt-btn[data-size="icon-lg"]{width:var(--control-h-lg);height:var(--control-h-lg);padding:0}
`;

function useInjected() {
  if (typeof document === "undefined") return;
  if (document.getElementById("sugt-btn-css")) return;
  const el = document.createElement("style");
  el.id = "sugt-btn-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function Button({
  variant = "default",
  size = "default",
  className = "",
  children,
  ...props
}) {
  useInjected();
  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size === "default" ? undefined : size}
      className={`sugt-btn ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export { CSS as buttonCss };
