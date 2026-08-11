# The public site uses the pre-Cache-Components caching model

`@sugt/public` reads the aggregates endpoints through route-segment `revalidate` and the fetch
Data Cache, with `cacheComponents` left unset. It does not use `use cache`, `cacheLife` or
`cacheTag`. Its fetch wrapper throws on a non-2xx response.

## Why

[ADR-0008](./0008-public-narrative-is-authored-in-the-internal-app.md)'s endpoint contract makes
two promises that read as configuration and are not: a failed fetch must fail the build, and the
last good payload must keep being served when the internal app is down.
[ADR-0001](./0001-public-site-reads-aggregates-only.md) calls "0 of 42 schools reached" worse
than publishing nothing, so an empty-data fallback is not an acceptable degradation.

Three models could satisfy those promises. **All three were measured, not reasoned about** —
against `next@16.2.12`, in production builds, with a stub that could be killed on command and
`ECONNREFUSED` counts confirming that revalidations genuinely ran and failed. All three served
the last good payload, so the stale-on-error question, which the framework documents for one
model and not the other, did not decide it.

**One measurement did.** Under `use cache`, with the origin down:

```
cc  (use cache)   googlebot -> HTTP 500      human -> HTTP 200
prev              googlebot -> HTTP 200      human -> HTTP 200
hybrid            googlebot -> HTTP 200      human -> HTTP 200
```

For a detected crawler Next skips the prerendered shell and renders the page dynamically at
request time, and that path does not fall back to the stale `use cache` entry the way the cached
path does. The bot receives Next's error document.

The confound was ruled out rather than argued away: configuration 2 and the hybrid differ in
both the cache primitive and the placement of `<Suspense>`, so the hybrid's boundary-free route
was rebuilt and given identical treatment. Its `ECONNREFUSED` count rose from 24 to 42 across
three spaced Googlebot requests — proving the revalidations really were failing — and every one
still returned 200 with the last good payload. **The difference is the primitive.**

The public site is DITSAMA ITB's portfolio and exists to be found. An outage that is invisible
to visitors and a hard 500 to Google is the worst shape this failure could take, because nothing
on the site would look wrong while it happened.

## Considered options

- **Cache Components (`use cache` + `cacheLife`).** The direction the framework is moving, and
  the cleanest expression of three independent payload lifetimes. Rejected on the crawler result
  above.
- **The hybrid — `cacheComponents: true` with the payloads on the fetch Data Cache.** Viable:
  it survives the crawler test, and neither `unstable_cache` nor the Data Cache is gated by the
  flag. Rejected because it carries a build trap in the dangerous direction — a
  `<Suspense>`-wrapped payload **builds green with the origin dead**, downgrading a static route
  to partial and serving 200 with no data, with no error and no non-zero exit. Avoiding that is
  a convention someone has to keep. This project prefers constraints.

## Consequences

- **The fetch wrapper must throw on `!res.ok`, and that is load-bearing.** `fetch` does not
  throw on a bad status. An internal app returning `500` to a bare `fetch` produces a green
  build with `undefined` baked into the HTML — the exact screen ADR-0001 forbids. The framework
  half is free (`prerenderEarlyExit` defaults to true, so a throw during prerender fails the
  build); the application half is not.
- **"Indefinitely" means "until the next deploy."** Caches are keyed by build ID, so every
  deploy re-exposes the build-time rule rather than only the first. No configuration expresses
  "fail on a bad fetch except when there is no good data yet", so this is handled by deployment
  sequencing.
- **`cacheComponents` must stay unset in `apps/public/next.config.ts`.** Enabling it removes
  route-segment `revalidate`, which is the mechanism this ADR depends on. If a future feature
  wants Partial Prerendering, this decision is what it has to reopen.
- **`expire: Infinity` in a `cacheLife` profile does the opposite of what it says.** The config
  is JSON round-tripped, `Infinity` becomes `null`, and the payload drops out of the prerender
  entirely. Use a large finite value. Recorded here because it is the kind of thing that is
  found once and then found again.
- Independent lifetimes for the three payloads work in this model, so ADR-0008's split by
  lifetime survives intact. A route re-render does not refetch Data Cache entries that are still
  fresh, so the fastest-moving payload does not drag the others with it.

## What this rests on

A measurement of one version. `docs/research/next16-caching.md` records the method and the
observed output, and opens with a banner saying so. **Re-run it before upgrading Next**, and
especially before enabling `cacheComponents` for any reason — the crawler behaviour is
undocumented in both 16.2.12 and 16.3, which means nothing obliges it to stay as it is.
