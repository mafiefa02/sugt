# Design system (imported bundle)

`system/` is a **snapshot** of the `SUGT Design System` project on
[claude.ai/design](https://claude.ai/design), exported 11 Aug 2026 and unpacked here.
It is reference material, not build input: nothing in the workspace imports it, and it
is excluded from `oxlint` and `oxfmt` (see `ignorePatterns` in `.oxlintrc.json` and
`.oxfmtrc.json` — without those entries the root `oxlint` run type-checks the
prototype JSX as if it were repo source).

The design medium is HTML/CSS/JS. These are **prototypes, not production code** —
recreate the visual output in React/Tailwind against `@sugt/ui`; don't port the
prototype's internal structure. Read the source rather than rendering it; the
dimensions, colors and layout rules are all spelled out in the files, and the
rendering harness was dropped on import (see below).

Concretely, one thing here must **not** be ported: `system/tokens/typography.css` opens
with `@import url('https://fonts.googleapis.com/css2?family=Montserrat…')`. That is how a
standalone HTML prototype gets a webfont. The apps load Montserrat through `next/font`,
which self-hosts it and avoids the render-blocking request — and `.oxlintrc.json` keeps
`nextjs/google-font-display` and `nextjs/google-font-preconnect` on as warnings precisely
to catch a stray `<link>` to Google Fonts. Take the `--font-*`, `--text-*`, `--weight-*`,
`--leading-*` and `--tracking-*` values from that file; leave the `@import` behind.

## It was generated *from* this repo

`system/github.md` records the direction: the design project was built by reading
`packages/ui/src/styles/globals.css`, `packages/ui/src/components/button.tsx`,
`CONTEXT.md` and `docs/product.md`. So most of it is a mirror. Diffing
`system/tokens/colors.css` against the `:root` and `.dark` blocks in `globals.css`:
`.dark` matches exactly, and every color declaration in `:root` matches too. The only
difference in that block is `--radius`, which the bundle factors out into
`tokens/radius.css` — and changes (see below). No color drift to reconcile.

What is genuinely *new* — design work with no counterpart in the repo:

| Path | Status |
| --- | --- |
| `system/ui_kits/public/`, `system/ui_kits/internal/` | Full surface compositions built from `docs/product.md`; the repo apps are still placeholders |
| `system/components/core/{Card,Badge,Input}.*` | Intentional additions, styled to base-rhea — no source component exists |
| `system/guidelines/*.card.html` | Written specs for color, type, spacing and brand voice |
| `system/assets/` | Brand marks (DPB, Sekolah Garuda) — not in the repo at all |
| `system/templates/public-hero/` | Hero template for the public site |

## Two conflicts, both now settled

The bundle disagreed with the repo on two points. Both were decided in favour of the
bundle, so `system/SKILL.md`'s claims about radius and icons are now **true** of this
workspace rather than pending.

1. **Corner radius — adopted.** `globals.css` had `--radius: 0` (square). It is now
   `0.625rem`, matching `system/tokens/radius.css`. Only the base value changed: the
   derived `--radius-sm` … `--radius-4xl` scale already existed and is identical on both
   sides. Do **not** also port `radius.css`'s structure — it declares that scale in
   `:root`, whereas the repo declares it in `globals.css`'s `@theme inline` block, which
   is what actually generates the Tailwind `rounded-*` utilities. One value, one place.

   This re-rounds everything at once, by design. `button.tsx` uses `rounded-2xl`
   (`--radius * 1.8`), so it went from 0 to 18px.

2. **Icon library — switched to Lucide.** `hugeicons` was declared in all three
   `components.json` files and installed as a `catalog:` dependency of `packages/ui`,
   `apps/public` and `apps/internal` — but no source file ever imported it. It has been
   replaced throughout by `lucide-react` (`catalog:` → `^1.31.0`), which is also the
   shadcn default, so registry items no longer need their icon imports rewritten.

   The prototypes reference icons by kebab-case Lucide name via `data-lucide`
   (`file-down`, `arrow-right`, `paperclip`, `plus`, `x`, `info`, `check`). In React
   those are PascalCase named exports from `lucide-react`: `FileDown`, `ArrowRight`,
   `Paperclip`, and so on.

## What was dropped on import

The full archive is `~/Downloads/SUGT Design System-handoff.zip` if any of this is needed.

- `uploads/` — byte-identical duplicates of `assets/` (verified by md5)
- `_ds_bundle.js`, `templates/public-hero/support.js`, `ds-base.js` — generated
  rendering harness for the claude.ai Design System pane (`support.js` is marked
  `GENERATED … do not edit`)
- `_ds_manifest.json`, `.thumbnail`, `thumbnail.html` — the pane's card index and
  preview images, recompiled server-side from `@dsCard` markers
- The bundle's top-level `README.md` — generic Claude Design boilerplate; its substance
  is the second paragraph above

`system/_adherence.oxlintrc.json` was **kept but not wired in**. Its rules restrict
imports across `components/core/**` and `ui_kits/**` — paths that exist in the design
project, not in this workspace — so it is a statement of intent, not a config this repo
can adopt as-is.

## Refreshing it

`/design-sync` does not do this. It pushes local files *up* to a claude.ai design-system
project; there is no method in the `DesignSync` tool that writes to disk. This bundle
also lives under a different account than the one this workspace's login reaches, so
refreshing means exporting the `.zip` again by hand and re-unpacking it here.

**Re-exporting overwrites the `Porting:` notes.** `system/` is a snapshot with one local
modification: each of the six CSS files carries a `Porting:` paragraph appended to its
existing header comment, saying what to take from it and what to leave. Those are not in
the upstream project, so a fresh export drops them. After re-unpacking, re-apply them —
`git diff` against the previous commit of `docs/design/system/**/*.css` shows exactly
what they were.
