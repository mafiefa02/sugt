# SUGT — STEM & Research Track

Sekolah Unggul Garuda Transformasi, as delivered by DITSAMA ITB. A public-facing
showcase of the Programme, plus an internal tool for tracking delivery and travel
administration.

Domain vocabulary lives in [`CONTEXT.md`](./CONTEXT.md); the decisions behind the
shape of this repo live in [`docs/adr/`](./docs/adr).

## Layout

```
apps/
  public/     the public site      → @sugt/public
  internal/   the internal tool    → @sugt/internal
packages/
  domain/     vocabulary shared by both apps
```

Two apps rather than one, because the public app must be unable to read Session
Records and Perjadin Reports — see
[ADR-0002](./docs/adr/0002-two-apps-in-a-pnpm-workspace.md). Data access will
arrive as its own package that only `@sugt/internal` declares.

The public site ships first and alone; the internal app is currently a placeholder
(see [ADR-0008](./docs/adr/0008-public-narrative-is-authored-in-the-internal-app.md)).

## Working on it

```bash
pnpm install

pnpm dev            # both apps — public on :3000, internal on :3001
pnpm dev:public     # just the public site
pnpm dev:internal   # just the internal tool

pnpm build          # both apps, in dependency order
pnpm typecheck      # next typegen && tsc --noEmit, per package
pnpm lint           # oxlint, type-aware
pnpm fmt            # oxfmt
```

`dev`, `build` and `typecheck` run through Turborepo, so an unchanged package is
restored from cache rather than rebuilt — a repeat `pnpm build` is milliseconds
instead of seconds. Scope any task to one package with
`turbo run <task> --filter=@sugt/public`.

`lint` and `fmt` deliberately bypass turbo: oxlint and oxfmt are single-process
scanners that cover the whole repo in well under a second, so per-package tasks
would cost more than they save.

## Dependency versions

Versions shared by both apps are pinned once in the `catalog:` block of
`pnpm-workspace.yaml`. Depend on `"catalog:"` rather than a range so the two apps
cannot drift apart on React or Next.
