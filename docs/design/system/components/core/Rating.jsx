import React from "react";

/* SUGT Rating — a 1–10 Aspect score.
   Intentional addition. Ratings are the only thing in the system anything counts,
   and there is no component for them anywhere in the source repo.

   Three rules, and all three come from the domain rather than from taste:

   1. THE NUMBER ALWAYS SHOWS. Magnitude is carried by the digit and by the length
      of the meter — both accessible channels. Colour only reinforces. This is not a
      concession to the palette; it is the right encoding, and the palette happens to
      make it the only one available.

   2. COLOUR ENCODES ONE BOUNDARY, NOT SEVERAL. The domain has exactly one threshold:
      CONCERN_AT_OR_BELOW = 7. At or below it the meter is red; above it, neutral grey.
      Banding 1–7 into "mild / bad / severe" would invent two more thresholds, and
      docs/adr/0006 already flinches at inventing the one that exists.

   3. WITHIN THE CONCERN RANGE, DENSITY IS CONTINUOUS. The fill deepens smoothly from
      7 to 1 — no steps, no categories. A 7 is faint; a 1 is solid.

   The palette has no green and no amber, so "good" is never green — it is quiet. That
   matches the readme's "counts, not claims": the system reports and a human judges. */

const CSS = `
.sugt-rating{display:inline-flex;align-items:center;gap:var(--space-2);font-family:var(--font-sans);
  line-height:1;white-space:nowrap}
.sugt-rating-label{font-size:var(--text-xs);font-weight:var(--weight-medium);color:var(--muted-foreground)}
.sugt-rating-meter{display:inline-flex;gap:2px;align-items:center}
.sugt-rating-seg{width:5px;height:12px;border-radius:1px;background:var(--muted)}
.sugt-rating-value{font-size:var(--text-sm);font-weight:var(--weight-semibold);
  font-variant-numeric:tabular-nums;min-width:1.25em;text-align:right;color:var(--foreground)}

/* Fine — 8, 9, 10. Never reaches the concerns list, so it is quiet, not green. */
.sugt-rating[data-tone="fine"] .sugt-rating-seg[data-on="1"]{background:var(--muted-foreground);opacity:.45}
.sugt-rating[data-tone="fine"] .sugt-rating-value{color:var(--muted-foreground)}

/* Concern — 7 down to 1. One colour; density rises continuously with severity. */
.sugt-rating[data-tone="concern"] .sugt-rating-seg[data-on="1"]{background:var(--destructive)}
.sugt-rating[data-tone="concern"] .sugt-rating-value{color:var(--destructive)}
.sugt-rating[data-value="7"] .sugt-rating-seg[data-on="1"]{opacity:.55}
.sugt-rating[data-value="6"] .sugt-rating-seg[data-on="1"]{opacity:.62}
.sugt-rating[data-value="5"] .sugt-rating-seg[data-on="1"]{opacity:.70}
.sugt-rating[data-value="4"] .sugt-rating-seg[data-on="1"]{opacity:.78}
.sugt-rating[data-value="3"] .sugt-rating-seg[data-on="1"]{opacity:.86}
.sugt-rating[data-value="2"] .sugt-rating-seg[data-on="1"]{opacity:.93}
.sugt-rating[data-value="1"] .sugt-rating-seg[data-on="1"]{opacity:1}

/* Compact — dense tables and list rows, where seven meters a row is too much ink.
   Same two tones, same continuous density, no meter. */
.sugt-rating[data-variant="compact"]{gap:var(--space-1-5)}
.sugt-rating[data-variant="compact"] .sugt-rating-meter{display:none}
.sugt-rating[data-variant="compact"] .sugt-rating-value{
  min-width:0;padding:2px var(--space-1-5);border-radius:var(--radius-sm);
  border:var(--border-width) solid transparent}
.sugt-rating[data-variant="compact"][data-tone="fine"] .sugt-rating-value{
  background:var(--muted);color:var(--muted-foreground)}
/* The digit on a tinted chip is --foreground, NOT --destructive. Red text on a red
   tint measures 2.96:1 at value 1 in light mode — below AA, and it gets worse as the
   chip deepens, which is exactly backwards. Measured, not guessed: --foreground gives
   12.3:1 light and 13.1:1 dark at the densest chip. --chart-5 was the other candidate
   and fails dark mode at 1.63:1. The chip carries the severity; the number stays
   legible. Don't "fix" this back to a red digit. */
.sugt-rating[data-variant="compact"][data-tone="concern"] .sugt-rating-value{
  color:var(--foreground);border-color:color-mix(in oklch,var(--destructive),transparent 55%)}
.sugt-rating[data-variant="compact"][data-value="7"] .sugt-rating-value{background:color-mix(in oklch,var(--destructive),transparent 92%)}
.sugt-rating[data-variant="compact"][data-value="6"] .sugt-rating-value{background:color-mix(in oklch,var(--destructive),transparent 89%)}
.sugt-rating[data-variant="compact"][data-value="5"] .sugt-rating-value{background:color-mix(in oklch,var(--destructive),transparent 86%)}
.sugt-rating[data-variant="compact"][data-value="4"] .sugt-rating-value{background:color-mix(in oklch,var(--destructive),transparent 83%)}
.sugt-rating[data-variant="compact"][data-value="3"] .sugt-rating-value{background:color-mix(in oklch,var(--destructive),transparent 80%)}
.sugt-rating[data-variant="compact"][data-value="2"] .sugt-rating-value{background:color-mix(in oklch,var(--destructive),transparent 77%)}
.sugt-rating[data-variant="compact"][data-value="1"] .sugt-rating-value{background:color-mix(in oklch,var(--destructive),transparent 74%)}
`;

/* The one threshold the domain has. Mirrors CONCERN_AT_OR_BELOW in @sugt/domain;
   if that constant moves, this moves with it — and so does a database migration,
   because it also sits in four index predicates. */
const CONCERN_AT_OR_BELOW = 7;
const RATING_MAX = 10;

function inject() {
  if (typeof document === "undefined" || document.getElementById("sugt-rating-css")) return;
  const el = document.createElement("style");
  el.id = "sugt-rating-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function Rating({ value, label, variant = "default", className = "", ...props }) {
  inject();
  const tone = value <= CONCERN_AT_OR_BELOW ? "concern" : "fine";
  return (
    <span
      className={`sugt-rating ${className}`.trim()}
      data-variant={variant}
      data-value={value}
      data-tone={tone}
      role="img"
      aria-label={`${label ? `${label}: ` : ""}${value} dari ${RATING_MAX}`}
      {...props}
    >
      {label ? <span className="sugt-rating-label">{label}</span> : null}
      <span className="sugt-rating-meter" aria-hidden="true">
        {Array.from({ length: RATING_MAX }, (_, i) => (
          <span key={i} className="sugt-rating-seg" data-on={i < value ? "1" : "0"} />
        ))}
      </span>
      <span className="sugt-rating-value">{value}</span>
    </span>
  );
}

export { CSS as ratingCss };
