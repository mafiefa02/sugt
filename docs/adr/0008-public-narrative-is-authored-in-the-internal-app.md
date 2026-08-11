# Public narrative is authored in the internal app

Stories and photographs for the public site are written and uploaded by Staff inside the internal app. The public app fetches published items through the same endpoint it uses for aggregates, and holds no database credentials of its own.

## Why

The alternative that costs nothing to build — content as MDX in the repository — makes the single developer the only person who can publish. Across a Programme of 42 Schools and dozens of trips, every photograph worth showing becomes a commit by the person who is also building the product. A hosted CMS removes that bottleneck but adds a service, a bill, and a third location for Programme data.

Authoring in the internal app reuses what already exists for other reasons: the sign-in from [ADR-0003](./0003-google-sign-in-with-an-invite-list.md), the object storage needed for receipts, and the aggregates endpoint from [ADR-0002](./0002-two-apps-in-a-pnpm-workspace.md).

## Student identities

Published content may name Schools and show students and their work. The Programme's enrolment terms include media consent, so no per-student permission is collected by this project and none needs to be built for.

## Deliberately not in the first release

> **Amended twice, and now void.** The sequencing below was reversed by [Amendment: the public site waits for the database](#amendment-the-public-site-waits-for-the-database), and the deferral it argues for was itself dropped by [Second amendment: the authoring UI is in the first release](#second-amendment-the-authoring-ui-is-in-the-first-release). The paragraph is kept because the rest of this ADR was argued on top of it.

The first release ships the public site alone, with launch content hand-seeded in the repository and scope figures as static reference data — no auth, no database, no aggregates endpoint, and so nothing blocked by the ITB conversation except DNS. The authoring UI described here arrives with the internal app. The publishing bottleneck this ADR exists to prevent is a month-six problem, not a week-one one; the absence of the UI at launch is a sequencing choice, not an oversight.

## Amendment: the public site waits for the database

Scope figures — Schools, Clusters, Topics, provinces — are served by the aggregates endpoint like everything else, and the database is their single source of truth. There is no hand-seeded copy in the repository at any point.

**Why the reversal.** The original plan left the same 42 Schools authored in two places: a static file the public site imports, and a seed migration the internal tool reads. Both were justified as frozen, and "frozen" is a claim about the next eighteen months. If it breaks, it breaks silently, on the portfolio site DITSAMA is judged by — and the whole reason [ADR-0001](./0001-public-site-reads-aggregates-only.md) permits live figures at all is that hand-maintained ones drift.

**What it costs.** Launch is now gated on the internal app existing, its database being seeded and the aggregates endpoint being built — which is precisely the dependency the original paragraph cut in order to ship early. That is accepted.

**What it does not change.** The public app still holds no database credentials and no Supabase client; it reads the endpoint and caches. [ADR-0001](./0001-public-site-reads-aggregates-only.md) and [ADR-0002](./0002-two-apps-in-a-pnpm-workspace.md) are untouched, and [ADR-0011](./0011-supabase-and-better-auth.md) restates why.

**Left open.** The deferral of the authoring UI rested partly on the public site shipping alone. That premise is gone, so the deferral now rests only on the bottleneck being a month-six problem. It is probably still right — but it is a thinner argument than the one written above, and worth confirming rather than inheriting. — _Confirmed and reversed; see below._

## Second amendment: the authoring UI is in the first release

The deferral above was examined rather than inherited, and it does not survive. **Stories and the authoring UI ship with the internal app, and the public site launches with real Stories in the database.** Nothing narrative is hand-seeded in this repository, at any point, for the same reason no scope figure is.

**Why the deferral fails.** It rested on the bottleneck being a month-six problem. But the alternative is launch content committed to `@sugt/public` and then migrated into `story` rows once the UI arrives — the launch narrative gets written twice, and in between the public site's most visible content is the one thing on it a Staff member cannot change. The first amendment already rejected two authored copies of the same 42 Schools; a second set of authored copies, of the material the portfolio actually leads with, is the same mistake with a shorter half-life.

**What it costs.** Launch is now gated on Better Auth working, the invite list existing ([ADR-0013](./0013-people-are-added-in-the-tool-and-their-role-is-write-once.md)), the `public-media` bucket, publishing tables and a Staff-only editor — on top of the aggregates endpoint the first amendment already added. That is a substantially larger gate than "one route handler", and it is accepted with that named.

**What it does not change.** Publishing is Staff-only, per [ADR-0004](./0004-delivery-data-is-open-internally-money-is-not.md). The public app still holds no database credentials and reads Stories through the same mechanism as the figures. And the wall below stands: a Story is authored for publication, and no internal record is ever a source for one.

The unit is a **Story** — `CONTEXT.md` has the term, added because three documents had three different names for a thing about to become a table.

## The endpoint contract

"The same endpoint" means the same mechanism, not one route. What the public app depends on:

- **Three routes, by lifetime.** Scope figures change ~never, delivery figures accrue weekly, Stories change when someone writes one. One payload behind one cache would revalidate everything at the fastest cadence any part of it needs, and one broken query would take the homepage's scope figures with it.
- **Server-side fetch, with a shared secret.** `@sugt/public` calls from a Server Component with a bearer token only it holds. The routes are never browser-reachable, so no visitor's request reaches Postgres and the figures stay crawlable — which matters on a portfolio site. Note this is a second unauthenticated path into the database alongside the Participant Feedback route; [ADR-0011](./0011-supabase-and-better-auth.md)'s "nothing unauthenticated ever touches the database" is about the anon **role**, and both of these go through the internal app's own credentials after a check.
- **Fixed sets never travel over it.** Two Streams, three Class kinds, ten Sessions per School are `@sugt/domain` constants both apps already depend on. Serving them from the database would recreate the duplication the first amendment removed, in the other direction.
- **One route goes the other way.** Publishing or unpublishing a Story makes the internal app call a revalidation route on `@sugt/public`, so a takedown is live in seconds instead of waiting for the next refresh. It is the only write-shaped thing the public app will have, and it writes nothing but its own cache — no database credential, no Supabase client, nothing that touches [ADR-0002](./0002-two-apps-in-a-pnpm-workspace.md).
- **A failed fetch never renders zeros.** At build time the fetch throws and the deploy fails, because a broken build is visible and a site of zeros is not. At runtime the last good payload is served until the next deploy. [ADR-0001](./0001-public-site-reads-aggregates-only.md) calls "0 of 42 schools reached" worse than publishing nothing, and an empty-data fallback produces exactly that screen by accident.

  Two corrections to that sentence, both measured rather than assumed — see [ADR-0014](./0014-the-public-site-uses-the-pre-cache-components-caching-model.md) and [`docs/research/next16-caching.md`](../research/next16-caching.md):

  **"Indefinitely" is really "until the next deploy."** Caches are keyed by build ID, so no stale payload survives a deployment — which means *every* deploy re-exposes the build-time rule, not just the first. That is a deployment-sequencing problem and no configuration expresses "fail on a bad fetch except when there is no good data yet".

  **The build-time half is an application obligation, not framework behaviour.** `fetch` does not throw on a bad status. An internal app returning `500` to a bare `fetch` produces a **green build** with `undefined` baked into the HTML — precisely the screen this bullet forbids. The fetch wrapper must throw on `!res.ok` itself.

- **Each payload carries a `version` integer, and `@sugt/public` refuses one it does not know.** The two apps deploy independently, so a payload change can land on one side first. Additive changes do not bump it; removing or retyping a field does. A refusal fails the build, which is where the rule above already puts every other bad fetch — the alternative is a page that renders half a payload and looks fine.

[`product.md`](../product.md) has how this reads on screen.

## This does not contradict ADR-0001

[ADR-0001](./0001-public-site-reads-aggregates-only.md) rules out internal records reaching public pages. Public narrative is a different kind of content: written deliberately for publication, by someone who knows it is public as they write it. Session Records and Perjadin Reports are filed after a trip on the understanding that they are not.

The two now live in the same application, which makes it tempting to serve them through the same publishing path. Doing so would destroy the candour that makes internal records — Class Records especially — worth keeping. The separation is the point, not an accident of where the code sits.
