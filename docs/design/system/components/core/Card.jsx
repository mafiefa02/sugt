import React from "react";

/* SUGT Card — surface container. Not in the source component set yet (the apps
   are placeholders); added to compose the product surfaces described in
   docs/product.md, styled strictly to the base-rhea vocabulary: bg-card, a 1px
   --border, rounded corners, no shadow. */

const CSS = `
.sugt-card{background:var(--card);color:var(--card-foreground);border:var(--border-width) solid var(--border);
  border-radius:var(--radius-lg);display:flex;flex-direction:column;font-family:var(--font-sans)}
.sugt-card__hd{display:flex;flex-direction:column;gap:var(--space-1);padding:var(--space-4) var(--space-5)}
.sugt-card__hd.has-body{border-bottom:var(--border-width) solid var(--border)}
.sugt-card__title{font-weight:var(--weight-semibold);font-size:var(--text-base);letter-spacing:var(--tracking-tight)}
.sugt-card__desc{font-size:var(--text-sm);color:var(--muted-foreground);line-height:var(--leading-normal)}
.sugt-card__body{padding:var(--space-5);flex:1}
.sugt-card__ft{padding:var(--space-4) var(--space-5);border-top:var(--border-width) solid var(--border);
  display:flex;gap:var(--space-2);align-items:center}
`;

function inject() {
  if (typeof document === "undefined" || document.getElementById("sugt-card-css")) return;
  const el = document.createElement("style");
  el.id = "sugt-card-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function Card({ title, description, footer, children, className = "", ...props }) {
  inject();
  const hasBody = children != null;
  return (
    <div className={`sugt-card ${className}`.trim()} {...props}>
      {(title || description) && (
        <div className={`sugt-card__hd${hasBody ? " has-body" : ""}`}>
          {title && <div className="sugt-card__title">{title}</div>}
          {description && <div className="sugt-card__desc">{description}</div>}
        </div>
      )}
      {hasBody && <div className="sugt-card__body">{children}</div>}
      {footer && <div className="sugt-card__ft">{footer}</div>}
    </div>
  );
}

export { CSS as cardCss };
