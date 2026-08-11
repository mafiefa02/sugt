# Two apps in a pnpm workspace, not one app routed by hostname

The public site and the internal tool are separate applications in this repo's pnpm workspace, sharing packages for domain types and data access, and deployed independently to `sugt.itb.ac.id` and `internal.sugt.itb.ac.id`.

## Why

[ADR-0001](./0001-public-site-reads-aggregates-only.md) requires that Session Records and Perjadin Reports never reach a public page. In a single app that rule is held by discipline — one careless import puts internal narrative on a public route, and only code review stands in the way. With separate apps the public app does not depend on the package that can read those records, so the leak is not merely unlikely but unbuildable. That package now exists and is `@sugt/db`; `@sugt/public` does not declare it.

Secondarily, the public site is the portfolio DITSAMA ITB is judged on and the internal tool is where staff file paperwork against deadlines. Independent deploys mean work on the latter cannot take down the former.

## Considered options

- **One app, hostname routing via middleware.** Nothing to restructure, one deploy, fastest to a first feature. Rejected: it makes the ADR-0001 boundary a convention rather than a constraint.
- **Two separate repositories.** The hardest wall, but the public site still needs live aggregates, so it would require a real API between them and shared domain types with nothing to stop them drifting. Too heavy for one developer.

## Consequences

- `src/` moves under `apps/` before feature work starts. Doing this later means rewriting import paths across a real codebase.
- Two builds and two deployment targets to configure and keep working.
- Both deploy to Vercel, on a domain DITSAMA controls rather than an `itb.ac.id` subdomain. Nothing here depends on ITB IT: no institutional DNS, no identity mandate (see [ADR-0003](./0003-google-sign-in-with-an-invite-list.md)), and no restriction on hosting data with a third party (see [ADR-0005](./0005-postgres-for-the-invariants-not-the-scale.md)).
- The public app holds no database credentials. It fetches the figures [ADR-0001](./0001-public-site-reads-aggregates-only.md) permits from an aggregates endpoint served by the internal app, and caches them. This is what makes the boundary a fact about access rather than about discipline — with direct database access, both ADRs would reduce to conventions.
