---
name: shadcn-sugt
description: How to run the shadcn CLI and where components belong in this pnpm monorepo. Read alongside the `shadcn` skill for any shadcn/ui work here — adding, updating, styling or composing components, theming, or anything touching components.json, @sugt/ui, or the `-/` alias.
allowed-tools: Bash(pnpm dlx shadcn@latest *)
---

# shadcn/ui in sugt

Repo-specific corrections to the `shadcn` skill. That skill is vendored upstream and
knows nothing about this workspace; everything below overrides it.

## The injected project context is empty here

The `shadcn` skill injects `shadcn info --json` from the working directory. The repo
root holds three `components.json` files, so that block comes back as:

```json
{ "error": "monorepo_root", "targets": ["apps/internal", "apps/public", "packages/ui"] }
```

Read that as **"no context loaded"** — not as a failure to work around. Fetch it
properly before anything else:

```bash
pnpm dlx shadcn@latest info --json -c apps/public    # or -c apps/internal
```

`docs`, `search` and `view` are registry-level and need no `-c`.

## Always `-c <an app>`, never `-c packages/ui`

| target | `components` alias | where `add <x>` writes |
| --- | --- | --- |
| `-c apps/public` / `-c apps/internal` | `-/components` | primitives → `packages/ui/src/components/`, composed blocks → that app's `src/components/` |
| `-c packages/ui` | `@sugt/ui/components` | **everything** → `packages/ui/src/components/` |

Targeting an app is what produces the split the workspace is built on: an app owns
what only it uses, both apps share everything else. Targeting `packages/ui` aliases
`components` to the same place as `ui`, so a login block lands among the primitives
and the split silently collapses. Shared primitives still land in `packages/ui`
either way, so when unsure, pass the app you are editing.

## Config facts that differ from shadcn's defaults

| field | value | what it changes |
| --- | --- | --- |
| `base` | `base` — Base UI (`@base-ui/react`) | custom triggers use `render={<X />}`, **never** `asChild`; see `../shadcn/rules/base-vs-radix.md` |
| `iconLibrary` | `lucide` | icons come from `lucide-react` — the shadcn default, so registry items need no icon rewriting |
| toasts | Base UI | use the `toast` component, not `sonner` |
| `style` | `base-rhea`, preset `b4iTlAJ44` | |
| `rsc` | `true` | anything with state, effects or handlers needs `"use client"` |
| `tailwind.css` | `packages/ui/src/styles/globals.css` | the only stylesheet — every token edit lands there, and its `@source` line is load-bearing (see AGENTS.md) |

Imports from inside an app:

- `@sugt/ui/components/<name>` — shared primitives
- `@sugt/ui/lib/utils` — `cn()`
- `-/components`, `-/lib`, `-/hooks` — that app's own files

## After every `add`, check three things

1. **Any new dependency must move to the catalog.** The CLI writes a plain range into
   `package.json`; this workspace declares shared versions once in the `catalog:`
   block of `pnpm-workspace.yaml` and depends on `catalog:`. Add the version there,
   change the range to `catalog:`, then `pnpm install`. This includes `shadcn`
   itself: it is a real dependency of `@sugt/ui` (`globals.css` imports
   `shadcn/tailwind.css`), so if the `@latest` CLI you just ran is newer than the
   catalog entry, bump the catalog too — the generated component and the CSS it is
   styled against are a matched pair.
2. **`@sugt/ui` stays presentational.** If a generated block fetches data, reads env,
   or imports `@sugt/domain`, it does not belong in `packages/ui` — move it into the
   app. Both apps depend on `@sugt/ui`, so anything it can reach, the public app can
   reach (ADR-0010, and the ADR-0001 boundary behind it).
3. **Run `pnpm fmt`.** oxfmt sorts Tailwind classes against the shared stylesheet;
   generated files arrive unsorted.
