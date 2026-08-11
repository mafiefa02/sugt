---
name: sugt-design
description: Use this skill to generate well-branded interfaces and assets for SUGT (Sekolah Unggul Garuda Transformasi — STEM & Research Track, delivered by DITSAMA ITB), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets
out and create static HTML files for the user to view — link `styles.css` for the real
tokens (Montserrat, brick-red primary, rounded corners) and compose the components in
`components/core/`. If working on production code, copy assets and read the rules here
to become an expert in designing with this brand; the source lives in `mafiefa02/sugt`
(shadcn base-rhea + Base UI, hugeicons, Tailwind v4).

Key rules to honour: rounded corners (`--radius: 0.625rem`); one brand hue (brick red),
no green/amber; Montserrat everywhere; icons are **Lucide** (canonical for this system —
the source repo declares hugeicons, but new work uses Lucide); copy is Indonesian for
public, English domain terms throughout; tone is counts-not-claims (never
"overdue"/"finished").

If the user invokes this skill without any other guidance, ask them what they want to
build or design, ask some questions, and act as an expert designer who outputs HTML
artifacts _or_ production code, depending on the need.
