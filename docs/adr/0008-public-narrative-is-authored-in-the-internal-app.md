# Public narrative is authored in the internal app

Stories and photographs for the public site are written and uploaded by Staff inside the internal app. The public app fetches published items through the same endpoint it uses for aggregates, and holds no database credentials of its own.

## Why

The alternative that costs nothing to build — content as MDX in the repository — makes the single developer the only person who can publish. Across a Programme of 42 Schools and dozens of trips, every photograph worth showing becomes a commit by the person who is also building the product. A hosted CMS removes that bottleneck but adds a service, a bill, and a third location for Programme data.

Authoring in the internal app reuses what already exists for other reasons: the sign-in from [ADR-0003](./0003-google-sign-in-with-an-invite-list.md), the object storage needed for receipts, and the aggregates endpoint from [ADR-0002](./0002-two-apps-in-a-pnpm-workspace.md).

## Student identities

Published content may name Schools and show students and their work. The Programme's enrolment terms include media consent, so no per-student permission is collected by this project and none needs to be built for.

## Deliberately not in the first release

The first release ships the public site alone, with launch content hand-seeded in the repository and scope figures as static reference data — no auth, no database, no aggregates endpoint, and so nothing blocked by the ITB conversation except DNS. The authoring UI described here arrives with the internal app. The publishing bottleneck this ADR exists to prevent is a month-six problem, not a week-one one; the absence of the UI at launch is a sequencing choice, not an oversight.

## This does not contradict ADR-0001

[ADR-0001](./0001-public-site-reads-aggregates-only.md) rules out internal records reaching public pages. Public narrative is a different kind of content: written deliberately for publication, by someone who knows it is public as they write it. Session Records and Perjadin Reports are filed after a trip on the understanding that they are not.

The two now live in the same application, which makes it tempting to serve them through the same publishing path. Doing so would destroy the candour that makes Session Records worth keeping. The separation is the point, not an accident of where the code sits.
