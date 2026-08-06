# One shared UI package, not shadcn installed per app

shadcn primitives and the design tokens live in `packages/ui` (`@sugt/ui`), which both apps depend on. Neither app keeps its own copy of a primitive, its own `cn`, or its own stylesheet.

## Why

The public site and the internal tool are one product to the people who use them and one design system to the person building them. With shadcn initialised separately in each app, sharing a component means copying it, and the two copies stay identical only for as long as someone remembers to copy the next change. The tokens are worse: `--primary` was already declared twice, in two files with no relationship, and nothing would have failed if they had diverged.

The alternative reading — that two apps with genuinely different audiences should be free to look different — is not what is wanted here. The internal tool is the same institution's work, seen by the same staff.

## Considered options

- **Leave shadcn per app and copy components across.** No new package, and each app free to diverge. Rejected: the divergence is the failure mode, not the freedom.
- **A published registry ([shadcn registries](https://ui.shadcn.com/docs/registry)), consumed by both apps.** The right answer if these components were shared beyond this repo. They are not, and it adds a publish step between editing a component and seeing it.

## Consequences

- `@sugt/ui` must stay presentational. Both apps depend on it, so anything it can reach, the public app can reach — a data-fetching helper or a `@sugt/domain` import inside it would route around the boundary [ADR-0002](./0002-two-apps-in-a-pnpm-workspace.md) builds out of the dependency graph. This is the one shared package where that risk exists, because it is the one both apps import.
- The design system now has a single owner in the tree, so a token change is one edit and a component change reaches both apps without a copy step.
- `shadcn add` must be run from an app directory. It reads that app's `components.json`, which aliases `ui` and `utils` into `@sugt/ui`, and routes primitives there and composed blocks into the app.
- Tailwind needs telling that `packages/ui` is a source directory; automatic detection skips `node_modules` and the package is reached through a pnpm symlink. `AGENTS.md` records where that declaration has to live and why.
- An app can still hold components only it uses, in its own `src/components`. The shared package is for what both apps need, not for everything that renders.
