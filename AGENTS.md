# sugt

Instructions for AI agents working in this repository.

## Workspace

A pnpm workspace with two apps and a shared package:

- `apps/public` (`@sugt/public`) — the public site, port 3000
- `apps/internal` (`@sugt/internal`) — the internal tool, port 3001
- `packages/domain` (`@sugt/domain`) — vocabulary shared by both

Three rules to work within:

1. **`@sugt/public` must never gain a dependency that can read Session Records or
   Perjadin Reports.** ADR-0002 claims that leak is unbuildable rather than merely
   unlikely; what makes that true is pnpm's strict symlinked `node_modules`, so an
   `.npmrc` with `node-linker=hoisted` or `shamefully-hoist=true` would quietly
   downgrade it to a convention. Don't add one.
2. **Shared dependency versions come from the `catalog:` block in
   `pnpm-workspace.yaml`**, not from ranges in an app's `package.json`.
3. **Add domain vocabulary to `packages/domain` only if it is in `CONTEXT.md` and
   needs no database.** Anything requiring stored data belongs in a data-access
   package (not yet created — ADR-0005 has not picked a vendor).

`@sugt/domain` is a Just-in-Time package: its `exports` point straight at
`./src/index.ts`, it has no build step, and Turbopack compiles it as part of
whichever app imports it (so no `transpilePackages` entry is needed — Next only
requires that for `node_modules` dependencies shipping raw TS). The tradeoff is
that turbo has no build output to cache for it. If it ever grows enough to be
worth caching, the documented upgrade is a Compiled Package: add a `build` script
and point `exports` at `./dist` with `types` at the source.

## Tooling

`dev`, `build` and `typecheck` are Turborepo tasks (`turbo.json`). `lint` and `fmt`
are deliberately **not** — and not merely because oxlint and oxfmt are fast. Turbo
supports root tasks (`"//#lint"`), but a root task hashes only root-level files, so
editing `apps/public/src/**` leaves it a cache hit and the changed code goes
unlinted. Verified, not assumed. Keep whole-repo scanners as plain root scripts.

`envMode` defaults to `strict`: a task only sees environment variables declared in
its `env` (or `globalEnv`). Nothing reads env yet, so there is nothing to declare —
but the first `DATABASE_URL` needs adding to the consuming task's `env`, or it will
be invisible at build time. `NEXT_PUBLIC_*` is handled automatically for Next apps.

Two things in `turbo.json` are load-bearing and easy to break:

- **`tsconfig.base.json` is listed in `globalDependencies`.** Turbo only hashes
  files inside a package, so without that entry an edit to the shared tsconfig
  would leave every build served from a stale cache. Any future shared config at
  the root needs adding there too.
- **`typecheck` declares no `outputs` on purpose.** It would otherwise capture
  `.next/types/**`, which `build` already owns — overlapping outputs between two
  tasks in the same package means two caches racing to write the same files. A
  cache hit here means "this input set already typechecked", which is the whole
  point of the task.

`tsconfig.base.json` holds vendor-neutral compiler options only. `paths`, the
`next` plugin and `include` are declared per package, because relative paths in an
inherited tsconfig resolve against the file that declares them.

Nested `.oxfmtrc.json` files **replace** the root config rather than merging with
it, so each app's copy restates every option it needs. Change a formatting rule in
all three.

`sortTailwindcss` lives only in the two app configs, each pointing at its own
`src/styles.css`, because nothing outside an app has Tailwind classes in it —
oxfmt does not sort inside markdown code fences either. A package that grows a
Tailwind surface needs its own `.oxfmtrc.json`; adding the key at the root would
not reach it. Note that a `stylesheet` path that doesn't resolve makes oxfmt skip
class sorting silently — no error, exit 0 — so check the path first when sorting
appears to stop working.

`.agents/skills/` holds the skills vendored from `mattpocock/skills`, hash-checked
by `skills-lock.json`; the formatter ignores it and so should you. `.claude/skills/`
is 25 symlinks into it and holds no content of its own — it exists because Claude
Code only discovers skills under `.claude/skills/`, so deleting it would make them
invisible. Don't try to collapse the two.

## Agent skills

### Issue tracker

Issues and PRDs are tracked as GitHub issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The canonical five-label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
