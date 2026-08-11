# Internal Tool UI kit — `@sugt/internal`

Interactive recreation of the SUGT internal tool surfaces from
`sugt/docs/product.md`. **The repo app is a placeholder**, so this kit is built to
the product specification, not copied from finished screens — see the root
`readme.md` caveat.

## Surfaces (click through them via the left nav)

- **Coverage** — the landing screen. Every School with its delivered count (`n / 10`),
  grouped by Cluster. Counts only, no health colour — as the spec insists. Select
  Schools to reveal the action bar and **Buat Perjadin**, which opens the creation
  form (the arranging: one PIC + a Teaching Team member per Stream, a fixed Advance).
- **Concerns** — the aggregated list of Session Record parts marked *some concerns* /
  *struggling*, newest first, each linking back to its Record.
- **Perjadin Report (acquittal)** — the load-bearing screen. Advance / used / returned
  figures, a transaction table with attached evidence and running total. Export is
  **gated until every transaction is evidenced** (deadline may pass; the document is
  never produced from an incomplete set). Click *Lampirkan* to evidence a row and watch
  the export unlock.

## Files

- `index.html` — loads the design system + Lucide, mounts `InternalTool`.
- `InternalTool.jsx` — Sidebar, Topbar, Coverage, PerjadinForm, Concerns, Acquittal.

Composes `Button`, `Card`, `Badge`, `Input`. Icons are Lucide via CDN (the canonical
icon set for this design system). Data is fabricated for demonstration.
