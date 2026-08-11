# Public narrative is authored in the internal app

Stories and photographs for the public site are written and uploaded by Staff inside the internal app. The public app fetches published items through the same endpoint it uses for aggregates, and holds no database credentials of its own.

## Why

The alternative that costs nothing to build — content as MDX in the repository — makes the single developer the only person who can publish. Across a Programme of 42 Schools and dozens of trips, every photograph worth showing becomes a commit by the person who is also building the product. A hosted CMS removes that bottleneck but adds a service, a bill, and a third location for Programme data.

Authoring in the internal app reuses what already exists for other reasons: the sign-in from [ADR-0003](./0003-google-sign-in-with-an-invite-list.md), the object storage needed for receipts, and the aggregates endpoint from [ADR-0002](./0002-two-apps-in-a-pnpm-workspace.md).

## Student identities

Published content may name Schools and show students and their work. The Programme's enrolment terms include media consent, so no per-student permission is collected by this project and none needs to be built for.

## Deliberately not in the first release

> **Amended — the sequencing below is reversed.** See [Amendment: the public site waits for the database](#amendment-the-public-site-waits-for-the-database). The paragraph is kept because the rest of this ADR was argued on top of it.

The first release ships the public site alone, with launch content hand-seeded in the repository and scope figures as static reference data — no auth, no database, no aggregates endpoint, and so nothing blocked by the ITB conversation except DNS. The authoring UI described here arrives with the internal app. The publishing bottleneck this ADR exists to prevent is a month-six problem, not a week-one one; the absence of the UI at launch is a sequencing choice, not an oversight.

## Amendment: the public site waits for the database

Scope figures — Schools, Clusters, Topics, provinces — are served by the aggregates endpoint like everything else, and the database is their single source of truth. There is no hand-seeded copy in the repository at any point.

**Why the reversal.** The original plan left the same 42 Schools authored in two places: a static file the public site imports, and a seed migration the internal tool reads. Both were justified as frozen, and "frozen" is a claim about the next eighteen months. If it breaks, it breaks silently, on the portfolio site DITSAMA is judged by — and the whole reason [ADR-0001](./0001-public-site-reads-aggregates-only.md) permits live figures at all is that hand-maintained ones drift.

**What it costs.** Launch is now gated on the internal app existing, its database being seeded and the aggregates endpoint being built — which is precisely the dependency the original paragraph cut in order to ship early. That is accepted.

**What it does not change.** The public app still holds no database credentials and no Supabase client; it reads the endpoint and caches. [ADR-0001](./0001-public-site-reads-aggregates-only.md) and [ADR-0002](./0002-two-apps-in-a-pnpm-workspace.md) are untouched, and [ADR-0011](./0011-supabase-and-better-auth.md) restates why.

**Left open.** The deferral of the authoring UI rested partly on the public site shipping alone. That premise is gone, so the deferral now rests only on the bottleneck being a month-six problem. It is probably still right — but it is a thinner argument than the one written above, and worth confirming rather than inheriting.

## This does not contradict ADR-0001

[ADR-0001](./0001-public-site-reads-aggregates-only.md) rules out internal records reaching public pages. Public narrative is a different kind of content: written deliberately for publication, by someone who knows it is public as they write it. Session Records and Perjadin Reports are filed after a trip on the understanding that they are not.

The two now live in the same application, which makes it tempting to serve them through the same publishing path. Doing so would destroy the candour that makes internal records — Class Records especially — worth keeping. The separation is the point, not an accident of where the code sits.
