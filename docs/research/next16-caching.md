# Next.js 16 caching: a last-good payload, and a build that fails on a bad fetch

> **Snapshot, not durable documentation.** Documentation claims are pinned to **`next@16.2.12`**
> (read from `node_modules/next/dist/docs/`, which ships version-exact) with some statements
> checked against the 16.3 web docs and labelled as such. The experiment at the foot was measured
> on **Next 16.2.12 / React 19.2.4 / Node v24.11.1 / macOS arm64** on **12 August 2026**. Behaviour
> here — especially the crawler result — is a property of that version, not of Next in general.
> Re-run the experiment before trusting it against any other release.

Research for [issue #7]. Establishes what the framework offers and how each option fails.
It does **not** choose the strategy — that is a separate ticket. Where the answer is a
trade-off, this document names both sides and stops.

The two rules being tested, from
[ADR-0008 "The endpoint contract"](../adr/0008-public-narrative-is-authored-in-the-internal-app.md)
and [`product.md`](../product.md):

1. **At build time, a failed fetch must fail the deploy.** A broken build is visible; a site of zeros is not.
2. **At runtime, the last good payload is served indefinitely.** The internal app being down is
   invisible to visitors, and a zero on the page is always a real zero.

---

## Version under test, and why it matters

`apps/public` (`@sugt/public`) depends on `next: "catalog:"`, and the catalog in
`pnpm-workspace.yaml` pins **`next: 16.2.12`**. The installed tree confirms it
(`apps/public/node_modules/next/package.json` → `"version": "16.2.12"`).

**nextjs.org does not serve versioned documentation.** Every page fetched for this research
carries `version: 16.3.0` in its frontmatter, one minor ahead of what is installed. The delta is
demonstrably behavioural — the 16.3 ISR page states outright: *"The App Shell for unlisted params
is served from Next.js 16.3. Earlier versions wait for a full server render before sending the
response."*

Fortunately the npm package ships its own documentation, generated for the exact installed
version, at `apps/public/node_modules/next/dist/docs/`. That directory is the primary source of
record for this document. Where a claim comes from the website instead, it is labelled.

### How claims are labelled

| Label | Meaning |
| --- | --- |
| **[16.2.12 docs]** | Verified in `node_modules/next/dist/docs/…` — the docs shipped with the installed version |
| **[16.2.12 source]** | Verified by reading `node_modules/next/dist/…` JS or `.d.ts` |
| **[16.3 web]** | From nextjs.org, which documents 16.3.0. Believed to hold for 16.2.12 but **not** version-verified |
| **[inferred]** | Not stated anywhere. Reasoning from documented parts, flagged as such |

---

## The fork everything hangs on: `cacheComponents`

Next.js 16 ships **two caching models**, and which one you are in is decided by a single config
flag. This is not a detail — the answer to rule 2 is *different in each*.

`apps/public/next.config.ts` currently sets `reactCompiler`, `typedRoutes`,
`experimental.useTypeScriptCli` and `experimental.typedEnv`. **It does not set
`cacheComponents`.** The default is `false` **[16.2.12 source]**
(`dist/server/config-shared.d.ts` → `cacheComponents: false` in the resolved-config defaults).

So today the app is in the *previous* model, and `use cache` is unavailable. This is not a
soft-fail. The installed source hard-throws:

```js
// node_modules/next/dist/server/use-cache/cache-life.js
function cacheLife(profile) {
    if (!process.env.__NEXT_USE_CACHE) {
        throw new Error('`cacheLife()` is only available with the `cacheComponents` config.');
        // __NEXT_ERROR_CODE: E887
    }
```

**[16.2.12 source]**

`cacheComponents` is a **top-level** config key in 16.2.12; `experimental.cacheComponents` exists
but is marked `@deprecated use top-level cacheComponents instead` **[16.2.12 source]**
(`dist/server/config-shared.d.ts:728`, `:1210`).

Enabling it is not a local change. Under Cache Components, the route segment configs `dynamic`,
`revalidate` and `fetchCache` are **replaced** by `use cache` + `cacheLife`:

> "When Cache Components is enabled, route segment configs like `dynamic`, `revalidate`, and
> `fetchCache` are replaced by `use cache` and `cacheLife`." **[16.2.12 docs]**
> (`dist/docs/01-app/02-guides/migrating-to-cache-components.md:15`;
> <https://nextjs.org/docs/app/guides/migrating-to-cache-components>)

It also makes Partial Prerendering the default App Router behaviour **[16.2.12 docs]**
(`dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md`;
<https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents>).

One thing does survive the switch: *"Your existing `fetch` and `unstable_cache` caching keeps
working as a separate layer"* **[16.2.12 docs]**
(`migrating-to-cache-components.md:19`). So the fetch Data Cache is available in **both** worlds;
route-segment `revalidate` and `use cache` are mutually exclusive.

---

## 1. The primitives, and which one is stale-on-error

### The crux, stated plainly

**The primitive with documented stale-on-error behaviour is ISR — route-segment `revalidate`
(the Full Route Cache) together with the `fetch` Data Cache and `unstable_cache`. That is the
*previous*, non-Cache-Components model.** The sentence that carries rule 2 is:

> ### Handling uncaught exceptions
>
> If an error is thrown while attempting to revalidate data, **the last successfully generated
> data will continue to be served from the cache**. On the next subsequent request, Next.js will
> retry revalidating the data.

**[16.2.12 docs]** — `dist/docs/01-app/02-guides/incremental-static-regeneration.md:459-463`,
inside an `<AppOnly>` block. Canonical URL:
<https://nextjs.org/docs/app/guides/incremental-static-regeneration#handling-uncaught-exceptions>

This is the only unambiguous stale-on-error guarantee in the entire documentation set. A
full-text search of the shipped 16.2.12 docs for `"last successfully generated"` returns four
hits, all in that one ISR guide (two in Pages-Router `getStaticProps` examples, one in the
Pages-Router prose, one in the App Router sentence above).

### And the asymmetry that matters

That guide opens with a scope note: *"This guide covers ISR without Cache Components."*
**[16.3 web]** (the 16.2.12 copy predates the split banner but the content is the pre-Cache-Components model).

**There is no equivalent guarantee documented for `use cache`.** Specifically:

- The Cache Components ISR guide **does not exist at all** in the 16.2.12 shipped docs — the file
  `incremental-static-regeneration-cache-components.md` is absent from
  `dist/docs/01-app/02-guides/`. It is a 16.3 addition. **[16.2.12 docs]**
- The 16.3 version of that guide has **no "Handling uncaught exceptions" section**, and no
  equivalent sentence. **[16.3 web]**
  (<https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components>)
- `getting-started/caching`, the Cache Components caching guide, discusses error *boundaries*
  (`catchError`, `error.js`) for containing a failed render, but says nothing about what the
  server cache does when a background refresh throws. **[16.3 web]**
  (<https://nextjs.org/docs/app/getting-started/caching>)
- `how-revalidation-works` has a **Graceful Degradation** section covering *cache write failure*
  and *cache read failure* — but not "the regeneration render itself threw". **[16.3 web]**
  (<https://nextjs.org/docs/app/guides/how-revalidation-works#graceful-degradation>)

So: **stale-on-error is documented for one caching model and undocumented for the other, and the
two are separated by a config flag `apps/public` does not currently set.** That is the single
most important finding in this document.

It is *plausible* the same behaviour holds for `use cache` — time-based revalidation is described
as "stale-while-revalidate", and *"The stale content continues to be served until the fresh
content is ready"* **[16.3 web]** (`how-revalidation-works`). But "until the fresh content is
ready" is a statement about *timing*, not about *failure*, and it does not say what happens if
fresh content never becomes ready because the render threw. Treating it as a guarantee is
**[inferred]**, and rule 2 is a hard commitment. If the strategy ticket picks `use cache`, this
needs an empirical test, not a citation.

### The full inventory

| Primitive | Available in 16.2.12? | Failure behaviour on a bad revalidation |
| --- | --- | --- |
| Route segment `export const revalidate` (ISR / Full Route Cache) | Yes — **only without `cacheComponents`** | **Serves last good.** Documented **[16.2.12 docs]** |
| `fetch(url, { next: { revalidate, tags } })` (Data Cache) | Yes — **in both models, source-verified** | Only `200` responses are stored; the ISR sentence covers the route **[16.2.12 docs]** / **[16.3 web]** |
| `unstable_cache(fn, keys, { revalidate, tags })` | Yes — **in both models, source-verified**, but marked replaced | Covered by the same ISR sentence. See deprecation note below **[16.2.12 docs]** |
| `use cache` directive | **No** — requires `cacheComponents: true`, currently unset | Stale-on-error **not documented** **[16.2.12 source + docs]** |
| `cacheLife(profile)` | **No** — throws `E887` without `cacheComponents` | n/a **[16.2.12 source]** |
| `cacheTag(tag)` | **No** — same gate | n/a **[16.2.12 docs]** |
| `revalidateTag(tag, profile)` | Yes | Invalidation primitive, not a fetch. See §3 |
| `revalidatePath(path, type?)` | Yes | Invalidation primitive. See §3 |
| `updateTag(tag)` | Yes, **but Server-Action-only** — see §3 | n/a |

### The two models are not mutually exclusive — a hybrid is available

The migration guide claims *"Your existing `fetch` and `unstable_cache` caching keeps working as a
separate layer"* **[16.2.12 docs]** (`migrating-to-cache-components.md:19`). That prose is
confirmed in the installed source **[16.2.12 source]**:

- `dist/server/web/spec-extension/unstable-cache.js` contains **no** `__NEXT_USE_CACHE` or
  `cacheComponents` gate — unlike `cache-life.js`, which throws `E887`. Its only throws are an
  invariant on `revalidate: 0` and a missing-incremental-cache invariant.
- `dist/server/lib/patch-fetch.js` — the module that installs the Data Cache extensions on
  `fetch` — contains **zero** occurrences of `__NEXT_USE_CACHE`.

**So `use cache` and the fetch Data Cache can coexist in one app.** This matters for the strategy
ticket: the choice is *not* binary. A hybrid is on the table — `use cache` + `cacheLife` +
`cacheTag` for clean per-payload lifetime expression, alongside a `fetch`-level Data Cache entry
for whichever payload most needs the documented stale-on-error behaviour.

What a hybrid does **not** recover is route-segment `revalidate`, which `cacheComponents`
genuinely does replace. And note the documented stale-on-error sentence lives in the *ISR* guide
and is phrased about revalidating **data**, not specifically about the route cache — whether it
extends to a Data Cache entry inside a Cache Components app is **[inferred]**, not documented.

**`unstable_cache` is on the way out.** Its 16.2.12 reference opens with:

> **Note:** This API has been replaced by `use cache` in Next.js 16. We recommend opting into
> Cache Components and replacing `unstable_cache` with the `use cache` directive.

**[16.2.12 docs]** (`dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md`;
<https://nextjs.org/docs/app/api-reference/functions/unstable_cache>). It is not needed here
anyway — `@sugt/public` fetches over HTTP, so the `fetch` Data Cache covers it. `unstable_cache`
exists for non-`fetch` sources like a direct database query, which this app deliberately does
not have.

### "Indefinitely" is a real constraint, and most profiles fail it

Rule 2 says the last good payload is served *indefinitely*. Under `cacheLife` that maps to
`expire`, and the preset table in the installed source is:

```js
// node_modules/next/dist/server/config-shared.js:136
cacheLife: {
  default: { stale: undefined, revalidate: 60*15,        expire: INFINITE_CACHE },
  seconds: { stale: 30,        revalidate: 1,            expire: 60 },
  minutes: { stale: 60*5,      revalidate: 60,           expire: 60*60 },
  hours:   { stale: 60*5,      revalidate: 60*60,        expire: 60*60*24 },
  days:    { stale: 60*5,      revalidate: 60*60*24,     expire: 60*60*24*7 },
  weeks:   { stale: 60*5,      revalidate: 60*60*24*7,   expire: 60*60*24*30 },
  max:     { stale: 60*5,      revalidate: 60*60*24*30,  expire: 60*60*24*365 },
}
```

**[16.2.12 source]** — this matches the published table exactly **[16.3 web]**
(<https://nextjs.org/docs/app/api-reference/functions/cacheLife>).

`expire` means: *"After this period with no traffic, the server regenerates content
**synchronously** on the next request"* **[16.3 web]**. A synchronous regeneration against a
down internal app is a blocking failure, not a stale serve.

**Only `default` never expires by time** — its `expire` is `INFINITE_CACHE`. Every other preset,
including `max`, expires eventually; `max` expires after **one year**.

That one year is not a trap peculiar to `max`. The previous model's equivalent knob, the
top-level `expireTime`, defaults to the same `31536000` **[16.2.12 source]**
(`dist/server/config-shared.js:127`), and it back-fills the `default` cacheLife profile's `expire`
when a partial `default` profile is declared **[16.2.12 source]** (`dist/server/config.js:927`).
One year is simply Next's general "effectively forever" convention.

The point that survives is narrower but still real: **rule 2 says *indefinitely*, and only
`default` or a custom profile with `expire: Infinity` delivers that literally.** `cacheLife`
rejects `expire: false` explicitly and tells you which value to use: *"Pass `Infinity` instead of
`false` if you want to cache on the server forever without checking with the origin."* — error
`E658` **[16.2.12 source]** (`dist/server/use-cache/cache-life.js`). Whether one year is close
enough to indefinite for this project is a strategy decision, not a research finding.

---

## 2. How a build-time fetch failure surfaces

### The framework half: an error during prerender stops the build

`experimental.prerenderEarlyExit` exists in 16.2.12 and **defaults to `true`** **[16.2.12 source]**
(`dist/server/config-shared.d.ts:300` for the declaration, `:1364` for the default). The CLI
reference documents what turning it off does, which establishes what leaving it on does:

> - Continues building even after the first prerender error, so you can see all issues at once:
>   - `experimental.prerenderEarlyExit = false`

**[16.2.12 docs]** (`dist/docs/01-app/03-api-reference/06-cli/next.md:293-294`;
<https://nextjs.org/docs/app/api-reference/cli/next#next-build-options>)

So by default `next build` exits on the **first** prerender error. Corroborating:

> "During the build process, the route is executed with each sample param to collect the HTML
> result. If dynamic content or runtime data are accessed incorrectly, **the build will fail**."

**[16.2.12 docs]** (`dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md:198`)

**So: if the render throws during prerendering, the deploy fails. Rule 1 is satisfiable, and by
default rather than by configuration.** But only given the next paragraph.

### The application half: `fetch` does not throw on a bad response — you must make it

This is the gap the ADR's wording hides. `fetch` follows the Web standard: it rejects on a
*network* error (connection refused, DNS failure, TLS error), but a `500`, `502` or `404`
**resolves normally** with `res.ok === false`. Nothing in Next.js changes that; the `fetch`
reference documents only the caching extensions **[16.2.12 docs]**
(<https://nextjs.org/docs/app/api-reference/functions/fetch>).

Two concrete consequences for `@sugt/public`:

- **The internal app returning `500` will not fail the build on its own.** `await res.json()`
  on an HTML error page throws a `SyntaxError`, which *would* fail the build — but that is an
  accident of the error body's content type, not a guarantee. A JSON-shaped error body
  (`{"error":"…"}`) parses fine and flows into the page. **[inferred]**
- **The recommended pattern in Next's own docs does the wrong thing here.** The Cache Components
  ISR guide's data helpers are written as:

  ```ts
  export async function getCategory(slug: string) {
    const res = await fetch(`${API}/categories/${slug}`)
    if (!res.ok) return null       // ← swallows the failure
    return res.json()
  }
  ```

  **[16.3 web]** (<https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components>).
  Copying that shape into `@sugt/public` produces exactly the screen ADR-0001 forbids: a `null`
  payload rendering as zeros, on a build that passed.

**Rule 1 is therefore an application obligation, not a framework behaviour.** The fetch wrapper
must `throw` on `!res.ok`, on a schema mismatch, and on a non-JSON content type. The framework
guarantee is only that *a throw during prerender fails the build*.

One related caveat worth carrying, even though it does not apply directly (the fetches go to a
*different* app, not to `@sugt/public`'s own routes):

> "For Server Components prerendered at build time, using Route Handlers will fail the build
> step. This is because, while building there is no server listening for these requests."

**[16.2.12 docs]** (`dist/docs/01-app/02-guides/backend-for-frontend.md:881`)

---

## 3. The revalidation route: shape, granularity, latency

### Shape

A `GET` or `POST` Route Handler at, say, `app/api/revalidate/route.ts`, calling `revalidateTag`.
`revalidateTag` *"can be called in Server Functions and Route Handlers"* **[16.2.12 docs]**
(`dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md`;
<https://nextjs.org/docs/app/api-reference/functions/revalidateTag>).

**The signature in 16.2.12 takes two arguments, and the second is required** **[16.2.12 source]**:

```ts
// node_modules/next/dist/server/web/spec-extension/revalidate.d.ts
type CacheLifeConfig = { expire?: number };
export declare function revalidateTag(tag: string, profile: string | CacheLifeConfig): undefined;
export declare function updateTag(tag: string): undefined;
export declare function refresh(): void;
export declare function revalidatePath(originalPath: string, type?: 'layout' | 'page'): undefined;
```

Note `profile` has no `?`. The one-argument form is a **type error** in 16.2.12, matching the
docs: *"The single-argument form `revalidateTag(tag)` is deprecated. It currently works if
TypeScript errors are suppressed, but this behavior may be removed in a future version."*
**[16.2.12 docs]**

**`updateTag` is unusable from this route.** Its own JSDoc in the installed source says: *"This
can only be called from within a Server Action to enable read-your-own-writes semantics."*
**[16.2.12 source]**. The internal app calls `@sugt/public` over HTTP, which lands in a Route
Handler, not a Server Action. So the choice is `revalidateTag` or `revalidatePath`.

### Granularity

Both tag- and path-level are available, and tags are the finer instrument:

- **Tags.** `cacheTag('stories')` inside a `use cache` scope, or `fetch(url, { next: { tags:
  ['stories'] } })` in the previous model. Limits: max tag length **256 characters**, max
  **128** tags per `fetch` call **[16.3 web]**
  (<https://nextjs.org/docs/app/api-reference/functions/fetch>); a single `cacheTag()` call
  accepts up to 128 tags of 256 characters, *"Tags longer than 256 characters are skipped, and
  any tags past the 128th in one call are dropped. Both cases log a console warning."*
  **[16.2.12 docs]** (`dist/docs/01-app/03-api-reference/04-functions/cacheTag.md:101`).
- **Paths.** `revalidatePath('/stories')` works through the same tag system using auto-generated
  "soft tags" prefixed `_N_T_`, invalidating the leaf route tag *and its ancestor layout tags*
  **[16.3 web]** (<https://nextjs.org/docs/app/guides/how-revalidation-works#soft-tags>). Because it
  sweeps ancestors, it is the blunter tool — `revalidatePath('/')` on a Story publish would
  invalidate the scope figures too.

Three tags (`scope`, `delivery`, `stories`) give exactly the Story-only granularity the contract
asks for.

### Latency — and a direct conflict with the ADR

The ADR promises a takedown is *"live in seconds instead of waiting for the next refresh."*
The recommended call does not deliver that:

> **With `profile="max"` (recommended)**: The tag entry is marked as stale, and the next time a
> resource with that tag is visited, it will use stale-while-revalidate semantics. This means
> **the stale content is served while fresh content is fetched in the background**.
>
> **Good to know**: When using `profile="max"`, `revalidateTag` marks tagged data as stale, but
> fresh data is only fetched when pages using that tag are next visited.

**[16.2.12 docs]** (`revalidateTag.md`)

So after an unpublish, **the next visitor still sees the withdrawn Story**, and only the visitor
after that sees it gone. For a takedown that is the wrong behaviour. The documented escape is
the immediate-expiry form:

> "For webhooks or third-party services that need immediate expiration, you can pass
> `{ expire: 0 }` as the second argument: `revalidateTag(tag, { expire: 0 })`. This pattern is
> necessary when external systems call your Route Handlers and require data to expire
> immediately."

**[16.2.12 docs]** (`revalidateTag.md`) — and `CacheLifeConfig = { expire?: number }` in the
installed types confirms the object form is accepted **[16.2.12 source]**.

But `{ expire: 0 }` means *"the next request to that resource will be a blocking
revalidate/cache miss"* **[16.2.12 docs]**. **A blocking revalidate against a down internal app
is precisely the failure rule 2 exists to prevent.**

> **This is the central tension for the strategy ticket.** Stale-on-error and
> immediate-takedown are the same knob pulled in opposite directions. `profile="max"` protects
> rule 2 and delays takedowns by one visit; `{ expire: 0 }` honours the takedown promise and
> opens a window where a failed refetch has no stale entry to fall back on. Note the asymmetry
> in stakes: a takedown is a *correctness/consent* concern, a stale figure is a *freshness*
> concern. They may deserve different answers per tag.

### Multi-instance caveat

> "When running multiple instances, the default file-system cache is per-instance. On-demand
> revalidation only invalidates the instance that receives the call."

**[16.3 web]** (<https://nextjs.org/docs/app/guides/incremental-static-regeneration#caveats>)

Also: *"Proxy won't be executed for on-demand ISR requests… Ensure you are revalidating the exact
path"* **[16.3 web]**, same section. If `@sugt/public` ever runs more than one instance, a
takedown reaches one of them unless a shared cache handler (`updateTags`/`refreshTags`) is
configured **[16.3 web]** (<https://nextjs.org/docs/app/guides/how-revalidation-works#multi-instance-considerations>).

Observability, useful for verifying any of this: the `x-nextjs-cache` response header reports
`HIT` / `STALE` / `MISS` / `REVALIDATED`, and `NEXT_PRIVATE_DEBUG_CACHE=1` logs cache decisions
**[16.3 web]** (ISR guide, Caveats + Troubleshooting).

---

## 4. Three payloads, three lifetimes — can they be independent?

**Yes, but the two models express it with different fidelity, and one of them couples at the
route level. This is not a critical finding — the contract's split survives — but the coupling is
real and the strategy ticket must account for it.**

### Under Cache Components (`use cache`) — cleanly independent

Three cached functions, each with its own `cacheLife` and `cacheTag`, are three independent cache
entries with independent lifetimes and independent invalidation. The cache key is derived per
function **[16.3 web]** (<https://nextjs.org/docs/app/api-reference/directives/use-cache#cache-keys>).
This maps onto the contract's three routes exactly:

- scope → changes ~never → a long profile, `expire: Infinity` for rule 2
- delivery → accrues weekly → `weeks`-shaped, or on-demand
- Stories → on write → long lifetime + `cacheTag('stories')`, invalidated by the route in §3

One rule to respect: nesting matters. *"If you don't call `cacheLife` in the outer cache, it uses
the `default` profile… Inner caches with shorter lifetimes can reduce the outer cache's `default`
lifetime."* **[16.3 web]**. And nesting a short-lived cache inside a `use cache` without an
explicit `cacheLife` **fails the build during prerendering** **[16.3 web]**. Setting an explicit
`cacheLife` in every scope avoids both.

### Under the previous model (fetch Data Cache + route `revalidate`) — data-level independent, route-level coupled

The three `fetch` calls hold three independent Data Cache entries with independent `revalidate`
values and independent tags. But the *page's* regeneration cadence is not independent:

> "If you have multiple `fetch` requests in a prerendered route, and each has a different
> `revalidate` frequency, **the lowest time will be used for ISR**. However, those revalidate
> frequencies will still be respected by the cache."

**[16.3 web]** (<https://nextjs.org/docs/app/guides/incremental-static-regeneration#caveats>), and:

> "The lowest `revalidate` across each layout and page of a single route will determine the
> revalidation frequency of the *entire* route."

**[16.3 web]** (<https://nextjs.org/docs/app/guides/caching-without-cache-components#revalidation-frequency>)

Read carefully, this may be **less bad than it sounds**, but the reasoning is an inference and is
flagged as one because the strategy ticket will lean on it:

- The *route* re-renders at the fastest cadence any payload needs (delivery's, weekly). This part
  is **documented**, in both caveats quoted above.
- A re-render **does not refetch** payloads whose Data Cache entries are still fresh — those
  frequencies "will still be respected by the cache". So scope figures would not be re-requested
  from the internal app on every delivery refresh, and the cost is extra renders rather than
  extra load on the endpoint. This is **[inferred]** from the second clause of the first caveat;
  no source states it directly.
- If the Stories fetch throws, the render throws, and ISR serves the last good *page* — scope
  figures included, stale but never zeros. The throw-fails-the-render half is **documented**;
  that ISR then serves the last good page is the §1 sentence, also **documented**.

Taken together these suggest the ADR's stated fear — *"one broken query would take the homepage's
scope figures with it"* — is **not** realised in this model. That conclusion is only as strong as
the inference in the second bullet, so it is carried into the Verification debt list below rather
than recorded here as settled.

**Verdict on point 4: the framework can express three lifetimes independently in both models. The
contract's three-route split is sound and is not invalidated.**

---

## 5. The first deploy, when the internal app may be unreachable

**Rule 1, taken literally, does make the first deploy fail — and that is the rule working, not a
bug.** ADR-0008's first amendment already accepted this: *"Launch is now gated on the internal app
existing, its database being seeded and the aggregates endpoint being built."*

The mechanism: on the first build there is no cache, every payload is a cache miss, all three
fetches run during prerendering. If the endpoint is unreachable, `fetch` rejects on the network
error, the render throws, `prerenderEarlyExit` (default `true`) stops the build **[16.2.12
source + docs]**. There is no last-good entry to fall back to — caches are scoped to a
deployment. Both models confirm this:

> "All of these stores are scoped to a single deployment. A new deploy starts fresh, new
> prerenders are built, and `use cache` entries don't carry over, **even durable `remote`
> ones**, because the cache key includes the build id."

**[16.3 web]** (<https://nextjs.org/docs/app/getting-started/caching#where-cached-content-is-stored>)

**This is worth stating clearly: rule 2 does not span deploys.** "Indefinitely" means "until the
next deployment". Every deploy re-runs the prerender and therefore re-exposes rule 1's failure
mode. The first deploy is not special — it is just the first instance of a condition that recurs
on **every** deploy. If the internal app is down during a routine redeploy, that deploy fails
too. (`deploymentId` overrides the build ID for cache-key purposes **[16.3 web]**, which is a
lever here but changes deploy semantics and is out of scope for this ticket.)

### The framework escapes, and why each costs something

There is no configuration that means "fail the build on a bad fetch, except when there is no
good data yet". The options are all trade-offs:

| Escape | What it costs |
| --- | --- |
| Wrap the fetch in `<Suspense>` and leave it uncached | The data is no longer prerendered, so it **cannot fail the build**. Rule 1 is abandoned for that payload |
| A short `cacheLife` (`seconds`, or `expire` < 5 min) | Short-lived caches are *"excluded from prerenders, becoming a dynamic hole resolved at request time"* **[16.3 web]** — same effect: no prerender, no build failure |
| `try/catch` returning a fallback | Renders zeros. Explicitly forbidden by ADR-0001 |
| Deployment sequencing | Costs process, not correctness |

**The resolution is sequencing, not a framework feature: stand the internal app and its endpoint
up first, verify the three routes respond, then deploy `@sugt/public`.** That is already what the
first amendment committed to. Rule 1 and "the first deploy completes" are in genuine tension, and
*which primitive is chosen decides which one wins* — anything that keeps a payload out of the
prerender silently forfeits rule 1 for it.

### A crawler caveat that bears on the portfolio requirement

ADR-0008 says the figures must "stay crawlable — which matters on a portfolio site". Under Cache
Components specifically:

> "Bots and crawlers are detected by their user agent and handled differently: because they need
> a complete document, Next.js **skips the shell and renders the entire page dynamically at
> request time**… If part of your shell depends on inputs that only exist while prerendering… a
> page that loads for a person can fail to render for a crawler."

**[16.3 web]** (<https://nextjs.org/docs/app/getting-started/caching#bots-and-crawlers>)

**[inferred]:** a crawler arriving while the internal app is down could get a failed render even
though human visitors are being served the cached page. This does not arise in the previous
model, where the prerendered HTML is served to everyone alike. Worth an explicit check if the
strategy ticket chooses Cache Components.

---

## 6. Interaction with `experimental.useTypeScriptCli`

**No documented interaction with caching, and none found in the source.** The flag is orthogonal:
it changes how `next build` type-checks, not how anything caches.

What it actually does, from the installed source **[16.2.12 source]**
(`dist/server/config-shared.d.ts:435`):

> "Runs the project-local TypeScript CLI instead of using TypeScript's programmatic API for
> build-time type checking **and config loading**."

It is a real, documented, `experimental`-namespaced option in 16.2.12 — `useTypeScriptCli?:
boolean`, default `false` **[16.2.12 source]** (`config-shared.d.ts:437`, `:1415`;
`config-schema.d.ts:175`). The repo's `next.config.ts` comment ("TS7's native compiler doesn't
expose the programmatic API Next uses") matches the docs:

> "Next.js does not enable this option automatically. If you install TypeScript 7 without
> enabling `experimental.useTypeScriptCli`, `next build` exits with instructions to enable the
> option or install a TypeScript version supported by the default checker."

**[16.2.12 docs]** (`dist/docs/01-app/03-api-reference/05-config/02-typescript.md:59`;
<https://nextjs.org/docs/app/api-reference/config/next-config-js/useTypeScriptCli>)

Three caveats that could touch this work indirectly **[16.2.12 docs]** (same file, lines 63-66):

- *"CLI type checking prints the native `tsc` diagnostics. It does not apply Next.js-specific
  code frames or rewrite errors for routes, pages, layouts, or route handlers."* → a type error
  in the revalidation Route Handler will read as raw `tsc` output.
- *"The CLI checks the complete project selected by your `tsconfig` file. This includes test
  files and `.next/dev/types` when they are included by that configuration."*
- *"`experimental.useTypeScriptCli` is experimental and its behavior may change."*

### The one genuine link, and it is already satisfied

If the strategy ticket defines **custom `cacheLife` profiles**, their types are generated, not
hand-written:

> "The `cacheLife` function's type signature is generated from `next.config.ts` during
> `next dev`, `next build`, or `next typegen`, so an overridden profile's editor autocomplete and
> JSDoc hint reflect the values you set, not the presets."

**[16.3 web]** (<https://nextjs.org/docs/app/api-reference/functions/cacheLife>)

`apps/public/package.json` already runs `"typecheck": "next typegen && tsc --noEmit"` and exposes
`"typegen": "next typegen"`, so the generation step is in place. **No change needed** — but a
custom profile added without re-running `typegen` would fail `tsc` under `useTypeScriptCli`,
because the CLI checks the project as `tsconfig` selects it and would not see the regenerated
type. **[inferred]**

Note also that `typescript.ignoreBuildErrors` *"skips the type-checking step, including the CLI
checker"* **[16.2.12 docs]** — it must not be set, or rule 1's sibling guarantee (a broken build
is visible) weakens.

---

## Summary for the strategy ticket

What is settled:

1. **Rule 1 is satisfiable and largely free** — `prerenderEarlyExit` defaults to `true`, so a
   throw during prerender fails the build. **But `fetch` does not throw on `!res.ok`; the
   application must.** This is the single most important implementation obligation.
2. **Rule 2 has a documented guarantee in exactly one model** — ISR / route-segment `revalidate`
   + the fetch Data Cache: *"the last successfully generated data will continue to be served from
   the cache"*. For `use cache` it is undocumented in both 16.2.12 and 16.3.
3. **`use cache`, `cacheLife` and `cacheTag` are unavailable as the app is configured today** —
   they need `cacheComponents: true`, which is unset, and enabling it removes route-segment
   `revalidate`.
4. **Three independent lifetimes are expressible in both models.** The contract's three-route
   split holds. Not a critical finding.
5. **"Indefinitely" means "until the next deploy"** in every model — caches are keyed by build ID.
6. **`useTypeScriptCli` is orthogonal**, and its only real touchpoint (typegen for custom
   `cacheLife` profiles) is already handled by the existing scripts.

What the strategy ticket must decide, with the trade-off named:

- **Which model — and note the choice is not binary.** Documented stale-on-error (previous model)
  versus cleaner three-lifetime expression and PPR (Cache Components) with stale-on-error
  unverified. Because neither `unstable_cache` nor the fetch Data Cache is gated by
  `cacheComponents` (source-verified, §1), a **hybrid** is available: `use cache` for lifetime
  expression alongside a `fetch`-level Data Cache entry for the payload that most needs the
  documented failure behaviour. If Cache Components is chosen in any form, **test the
  stale-on-error behaviour empirically before relying on it** — kill the internal app, force a
  revalidation, and confirm the last good page is still served.
- **Takedown semantics per tag.** `revalidateTag(tag, 'max')` protects rule 2 but delays a
  takedown by one visit; `revalidateTag(tag, { expire: 0 })` honours "live in seconds" but makes
  the next request a blocking revalidate that can fail. Stories may warrant a different answer
  from the figures.
- **Deploy sequencing**, since every deploy re-exposes rule 1 and no cache survives it.

### Verification debt

These are the claims this document could not settle from primary sources at the installed
version, listed so they are not silently inherited as fact:

- Whether `use cache` serves stale on a failed revalidation. **Undocumented.** Needs an experiment.
- Whether the ISR stale-on-error sentence extends to a `fetch` Data Cache entry inside a
  Cache Components app. The two layers provably coexist (source-verified), but the sentence is
  written in the non-Cache-Components guide. This is what makes the hybrid attractive, so it is
  the highest-value thing to verify.
- Whether a route re-render skips refetching payloads whose Data Cache entries are still fresh
  (§4, second bullet). If it does not, the previous model re-requests all three payloads at the
  fastest cadence, which is a load and blast-radius concern rather than a correctness one.
- Whether the 16.3 web docs' behavioural statements hold unchanged in 16.2.12 wherever labelled
  **[16.3 web]**. Spot-checks against the shipped 16.2.12 docs matched every time they overlapped
  (`revalidateTag`, `cacheTag` limits, `unstable_cache`, `cacheComponents`, the `cacheLife` preset
  table), so the risk is low but non-zero.
- Whether a crawler hitting a Cache Components page during an internal-app outage gets a failed
  render (§5). Inferred from the bots-and-crawlers note.

---

# Experiment: observed stale-on-error behaviour

Run for [issue #20], to settle by observation what the sections above could only infer.
Everything below is **copied terminal output and rendered values**, not expectation. Where a
result contradicts something above, that is said plainly.

**Headline: rule 2 holds in all three configurations. Rule 1 does not — it is forfeited silently
in two of them, and the `use cache` model additionally serves a `500` to crawlers during an
outage while serving `200` to humans.**

## Environment observed on

| | |
| --- | --- |
| Next.js | **16.2.12** (matches the catalog pin; verified in the experiment's own `node_modules`) |
| React / React DOM | **19.2.4** / **19.2.4** |
| Node.js | **v24.11.1** |
| pnpm | 11.20.0 |
| OS | **macOS 27.0** (build 26A5388g), arm64 (Apple Silicon) |
| Mode | production only — `next build` then `next start`. No `next dev` result is reported |
| Date | 2026-08-12 |

### The rig

A throwaway pnpm workspace outside this repo, three sibling Next apps sharing one lockfile. A
dependency-free Node stub on `127.0.0.1:4599` returns `{"schools":42,"n":<counter>}` and
**increments `n` on every request**, so a rendered `n` distinguishes fresh from stale
unambiguously. A `STUB_MODE=error500` switch makes it return HTTP `500` with a **JSON-shaped**
body (`{"error":"internal app is broken","n":…}`) — chosen deliberately so `res.json()` parses
and cannot fail the build by accident, isolating the `!res.ok` question (§2).

Every server ran with `NEXT_PRIVATE_DEBUG_CACHE=1`; every request was made with `curl -D -` so
that HTTP status, the `x-nextjs-cache` header and the rendered value were captured together. A
`STRICT=1` environment variable switches the data helper between a bare `fetch` and one that
throws on `!res.ok`. The stub was restarted between configurations with an offset counter
(`START_N`) so values from different runs can never be confused.

Method note: "`n` did not change" alone would be equally consistent with *no revalidation was
attempted*. Every stale-serve claim below is therefore paired with the matching
`ECONNREFUSED` trace from the server log, which is what proves a revalidation ran **and threw**.

---

## Configuration 1 — previous model (`cacheComponents` unset)

`export const revalidate = 5` plus two Data Cache fetches: `/fast` at `revalidate: 5` and
`/slow` at `revalidate: 3600`. Build output: `○ /  Revalidate 5s  Expire 1y`.

### (a)–(d) Runtime

```
--- 19:56:48Z warm-final     GET :3101/ -> HTTP 200 x-nextjs-cache: STALE
    fast: schools=42 n=7 err=undefined
    slow: schools=42 n=3 err=undefined
=== KILLING STUB ===
curl: (7) Failed to connect to 127.0.0.1 port 4599 after 0 ms: Couldn't connect to server
--- 19:56:56Z b: first after kill GET :3101/ -> HTTP 200 x-nextjs-cache: STALE
    fast: schools=42 n=8 err=undefined
    slow: schools=42 n=3 err=undefined
--- 19:56:56Z c1: immediate   GET :3101/ -> HTTP 200 x-nextjs-cache: HIT
    fast: schools=42 n=8 ...
--- 19:57:07Z c3: +10s        GET :3101/ -> HTTP 200 x-nextjs-cache: STALE
    fast: schools=42 n=8 ...
--- 19:57:15Z c4: +18s        GET :3101/ -> HTTP 200 x-nextjs-cache: STALE
    fast: schools=42 n=8 ...
```

**(b) Last good value served. HTTP 200. No error page, no zeros.** And the revalidation really
was attempted and really did throw — three times, once per subsequent stale request:

```
FileSystemCache: get 0e669ba2…3418f1 [] FETCH true
⨯ TypeError: fetch failed
    at ignore-listed frames {
  digest: '172838375',
  [cause]: Error: connect ECONNREFUSED 127.0.0.1:4599 {
    errno: -61, code: 'ECONNREFUSED', syscall: 'connect',
    address: '127.0.0.1', port: 4599 }
}
FileSystemCache: set /index
```

**(c) It retries and does not degrade.** Within the 5s window a request is a plain `HIT`; past
it, `STALE` plus a fresh revalidation attempt. Held steady across 18 s and four requests.

**(d) Full recovery**, stub restarted with the counter at 100:

```
--- 19:57:49Z d1 GET :3101/ -> HTTP 200 x-nextjs-cache: STALE   fast: n=8     <- last good, refresh fired
--- 19:57:50Z d2 GET :3101/ -> HTTP 200 x-nextjs-cache: HIT     fast: n=101   <- fresh
--- 19:57:57Z d4 GET :3101/ -> HTTP 200 x-nextjs-cache: HIT     fast: n=102
```

Note the shape: the first request after the origin returns is still **stale**; the request after
it is fresh. Recovery costs one visit, exactly as `revalidateTag(tag,'max')` does in §3.

### (e) Build

| Stub state | Helper | `next build` | Result |
| --- | --- | --- | --- |
| **Down** (ECONNREFUSED) | bare `fetch` | **exit 1** | `TypeError: fetch failed` → `Export encountered an error on /page: /, exiting the build.` |
| **Up, returns `500`** (JSON body) | bare `fetch` | **exit 0** | Build **passes** |
| **Up, returns `500`** (JSON body) | throws on `!res.ok` | **exit 1** | `Error: STRICT: stub returned HTTP 500 for /fast` |

**§2 is confirmed exactly, and this is the sharpest result in the experiment.** The passing build
in row 2 baked this into `.next/server/app/index.html`:

```
fast: schools=undefined n=202 err=internal app is broken
slow: schools=undefined n=203 err=internal app is broken
```

A green build, a deployed site, and `schools=undefined` where a figure belongs — render that
through any `?? 0` and it is the screen ADR-0001 forbids. **Rule 1 is an application obligation.
The framework contributes only "a throw during prerender fails the build".**

### Bonus: debt item 3 settled in passing

Stub log for the whole config-1 run. `/fast` (revalidate 5s) was requested seven times; `/slow`
(revalidate 3600s) **exactly once, at build**, across ~15 route regenerations spanning two minutes:

```
[stub 19:55:45.490Z] GET /fast  n=2     <- build
[stub 19:55:45.497Z] GET /slow  n=3     <- build, and never again
[stub 19:56:07.155Z] GET /fast  n=4
[stub 19:56:13.234Z] GET /fast  n=5
[stub 19:56:19.304Z] GET /fast  n=6
[stub 19:56:27.555Z] GET /fast  n=7
[stub 19:56:48.596Z] GET /fast  n=8
```

**A route re-render does not refetch payloads whose Data Cache entries are still fresh.** The
inference in §4 was right; the ADR's fear that the route cadence multiplies load on the endpoint
is not realised.

---

## Configuration 2 — Cache Components (`use cache` + `cacheLife`)

`cacheComponents: true`, a custom `cacheLife` profile, two routes: `/` reaching the stub through
raw `node:http` (so **`use cache` is provably the only cache layer** — `patch-fetch` cannot
serve underneath), and `/viafetch` using a plain `fetch` inside `use cache` (the realistic shape).
Both behaved identically throughout.

### Two build blockers found before the experiment could run

Both are worth recording; the second contradicts a suggestion in §1.

**(i) `cache: 'no-store'` inside a `use cache` scope is rejected.** The first attempt at isolating
the layers failed at build:

```
Error: Route "/": Uncached data was accessed outside of <Suspense>. This delays the entire
page from rendering, resulting in a slow user experience.
  at Page (app/page.tsx:19:19)
```

A `no-store` fetch does not merely bypass the Data Cache — it makes the enclosing `use cache`
function count as uncached data. Hence the `node:http` route.

**(ii) `expire: Infinity` in a `next.config.ts` `cacheLife` profile silently makes the entry
dynamic.** `{ stale: 1, revalidate: 5, expire: Infinity }` produced the same
"Uncached data was accessed outside of `<Suspense>`" failure. Changing only `expire` to
`31536000` made the identical page build as `○ (Static)`. The mechanism, source-verified:

```js
// dist/server/use-cache/constants.js
const DYNAMIC_EXPIRE = 300 // 5 minutes
// dist/server/use-cache/use-cache-wrapper.js:1324
if (entry !== undefined && (entry.revalidate === 0 || entry.expire < _constants.DYNAMIC_EXPIRE)) { … }
```

The config is JSON round-tripped on its way into the build (`.next/required-server-files.json`
holds the resolved copy), and `JSON.stringify({expire: Infinity})` is `{"expire":null}`. In JS
`null < 300` is `true`, so the entry is classified short-lived and dropped from the prerender.

**This directly qualifies §1.** That section says rule 2's "indefinitely" is delivered literally
only by `default` or *"a custom profile with `expire: Infinity`"*, citing error `E658`'s advice to
pass `Infinity`. That advice holds for an **inline** `cacheLife({…})` call; written into a
**`next.config.ts` profile it does the opposite of what is intended** — it silently converts the
payload into a request-time dynamic hole, which forfeits rule 1 (no prerender, so no build-time
fetch, so nothing to fail the build). A large finite `expire` such as `31536000` — Next's own
"effectively forever" convention, per `expireTime` in §1 — is the working form.

With `{ stale: 300, revalidate: 5, expire: 31536000 }`:

```
Route (app)      Revalidate  Expire
┌ ○ /                    5s      1y
└ ○ /viafetch            5s      1y
```

### (a)–(d) Runtime

Isolation was verified first: the stub log shows **exactly one request per route per 5 s
revalidation window** (`n=401…408`), so `use cache` is doing the caching and nothing is serving
underneath it.

```
=== KILLING STUB ===
--- 20:03:12Z b: first after kill GET :3102/         -> HTTP 200 x-nextjs-cache: STALE
    usecache: schools=42 n=407 err=undefined
--- 20:03:12Z b: first after kill GET :3102/viafetch -> HTTP 200 x-nextjs-cache: STALE
    viafetch: schools=42 n=408 err=undefined
--- 20:03:12Z c1: immediate      GET :3102/          -> HTTP 200 x-nextjs-cache: HIT    n=407
--- 20:03:20Z c2: +8s            GET :3102/          -> HTTP 200 x-nextjs-cache: STALE  n=407
--- 20:03:28Z c3: +16s           GET :3102/          -> HTTP 200 x-nextjs-cache: STALE  n=407
```

**`use cache` serves the last good payload when a revalidation throws.** The proof that the
refresh ran and failed, from the server log — note this is the `use cache` handler
(`DefaultCacheHandler`), not the Full Route Cache:

```
use-cache: Resume Data Cache entry not found ["2HBH1Wq…","807ec116…",[]]
DefaultCacheHandler: get ["2HBH1Wq…","807ec116…",[]] expired
⨯ Error: connect ECONNREFUSED 127.0.0.1:4599 { errno: -61, code: 'ECONNREFUSED', … }
DefaultCacheHandler: set ["2HBH1Wq…","807ec116…",[]] start
DefaultCacheHandler: set ["2HBH1Wq…","807ec116…",[]] failed Error: connect ECONNREFUSED 127.0.0.1:4599
```

(The `get … expired` line reads alarmingly given `expire` was 1 year. It means "past
`revalidate`", i.e. due for refresh — not "past `expire`, discard". The entry was still there to
serve, which is the whole point.)

The failed write leaves the previous entry in place. **(c)** retries every window and does not
degrade. **(d)** recovered on the request after the stub returned: `n=407` (STALE) → `n=501` (HIT).

### (e) Build

Identical to configuration 1 in every row:

| Stub state | Helper | `next build` |
| --- | --- | --- |
| Down | bare | **exit 1** — `Error: connect ECONNREFUSED` → `exiting the build` |
| Up, `500` | bare | **exit 0** — bakes `usecache: schools=undefined n=603 err=internal app is broken` |
| Up, `500` | throws on `!res.ok` | **exit 1** — `STRICT: stub returned HTTP 500 for /usecache` |

Enabling Cache Components changes nothing about rule 1, **provided the cached function is long-
lived enough to be prerendered** — which is exactly what blocker (ii) above can silently take away.

---

## Configuration 3 — hybrid (`cacheComponents: true` + Data Cache / `unstable_cache`)

Three routes: `/` — `fetch(url, { next: { revalidate: 5, tags } })` inside `<Suspense>`;
`/unstable` — `unstable_cache(fn, keys, { revalidate: 5, tags })` inside `<Suspense>`;
`/direct` — the same Data Cache fetch **not** wrapped in `<Suspense>`.

First result, before any failure was induced: with the stub up, **all three prerendered**, and
all three hit the stub at build time (`n=701,702,703`).

```
Route (app)      Revalidate  Expire
┌ ○ /                    5s      1y
├ ○ /direct              1h      1y
└ ○ /unstable            5s      1y
```

So a `fetch` with `next: { revalidate }` and an `unstable_cache` call both **count as cached data
under `cacheComponents`** and are prerendered — including inside a Suspense boundary. The two
layers do not merely coexist (§1, source-verified); the Data Cache is a first-class cached source
in a Cache Components build.

### (a)–(d) Runtime

```
=== KILLING STUB ===
--- 20:06:33Z b: first after kill GET :3103/         -> HTTP 200 x-nextjs-cache: STALE
    datacache: schools=42 n=710 err=undefined
--- 20:06:33Z b: first after kill GET :3103/unstable -> HTTP 200 x-nextjs-cache: STALE
    unstable: schools=42 n=711 err=undefined
--- 20:06:34Z b: first after kill GET :3103/direct   -> HTTP 200 x-nextjs-cache: HIT
    direct: schools=42 n=701 err=undefined
--- 20:06:42Z c2: +8s   -> HTTP 200 STALE  n=710 / n=711
--- 20:06:50Z c3: +16s  -> HTTP 200 STALE  n=710 / n=711
```

**The ISR stale-on-error sentence does reach across into a Cache Components app.** Nine
`ECONNREFUSED` traces in the server log confirm the refreshes ran and threw; `unstable_cache`
names the failing entry outright:

```
revalidating cache with key: async()=>{let a=await fetch("http://127.0.0.1:4599/unstable",…)}-unstable-payload-[]
  TypeError: fetch failed
    at async d.revalidate (.next/server/chunks/ssr/_0-a4y06._.js:24:4317) {
  [cause]: Error: connect ECONNREFUSED 127.0.0.1:4599 { errno: -61, code: 'ECONNREFUSED', … }
```

**(d)** recovered on the next request: `n=710/711` (STALE) → `n=801/802` (HIT).

### (e) Build — where the hybrid diverges, in both directions

With the stub **down**, the build fails — but on `/direct` only. Re-run with
`--debug-prerender` (which disables `prerenderEarlyExit`) to see every failure at once:

```
Error occurred prerendering page "/direct". Read more: https://nextjs.org/docs/messages/prerender-error
> Export encountered errors on 1 path:
	/direct/page: /direct
```

Removing `/direct` and building the two `<Suspense>`-wrapped routes against a **dead** stub:

```
✓ Generating static pages using 5 workers (4/4) in 279ms

Route (app)      Revalidate  Expire
┌ ◐ /                    5s      1y
└ ◐ /unstable            5s      1y

○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content

BUILD EXIT CODE = 0
```

**`<Suspense>` converts a build failure into a silent downgrade from `○` to `◐`.** Same code, same
config; the only difference is whether the origin answered. Serving that green build with the
stub still down:

```
--- 20:08:25Z GET :3104/         -> HTTP 200 <no x-nextjs-cache header>
    loading
--- 20:08:25Z GET :3104/unstable -> HTTP 200 <no x-nextjs-cache header>
    loading
```

HTTP `200`, shell renders, payload never arrives. The escape-hatch row in §5 ("wrap in
`<Suspense>` … rule 1 is abandoned for that payload") is confirmed, and it is worse than the table
implies: **nothing in the build output flags it as an error.** The `○`→`◐` change in the route
table is the only signal, and it is not an error, not a warning, and not a non-zero exit code.

The `500` rows, however, go the *other* way and are genuinely good news:

| Route | Stub `500`, **bare** `fetch` | Stub `500`, throws on `!res.ok` |
| --- | --- | --- |
| `/direct` (no Suspense) | **exit 1** | **exit 1** |
| `/` (Suspense, Data Cache) | exit 0, degrades to `◐` | exit 1 |
| `/unstable` (Suspense, `unstable_cache`) | exit 0, stays `○` — **bakes the `500` body in** | exit 1 |

`/direct` failed with a message that is not about fetching at all:

```
Error: Route "/direct": Uncached data was accessed outside of <Suspense>.
Error occurred prerendering page "/direct". Read more: https://nextjs.org/docs/messages/prerender-error
```

**Because only `200` responses are stored in the Data Cache (§1), a `500` leaves the fetch
uncached — and `cacheComponents` refuses to prerender uncached data outside `<Suspense>`.** So
`cacheComponents` + Data Cache + no `<Suspense>` fails the build on a bad status *even with a bare
`fetch`*, which configuration 1 does not. That is a real safety margin the previous model lacks —
but it is a side effect of a rule about Suspense, not a guarantee about data, so it should not be
leaned on in place of the throwing wrapper. `unstable_cache` shows why: it caches the **function's
return value** regardless of HTTP status, stayed `○`, and baked the error body into the prerender.

---

## The crawler result — the one genuinely bad finding

§5 flagged as **[inferred]** that a crawler could get a failed render during an outage under Cache
Components. **It is real, and it is fully reproducible.** With the origin down and each app
serving its last good payload happily to a browser user-agent:

```
  cc  (use cache)   googlebot -> HTTP 500      human -> HTTP 200
  cc  (use cache)   googlebot -> HTTP 500      human -> HTTP 200
  cc  (use cache)   googlebot -> HTTP 500      human -> HTTP 200
  prev              googlebot -> HTTP 200      human -> HTTP 200
  hybrid            googlebot -> HTTP 200      human -> HTTP 200
```

The bot receives Next's `<html id="__next_error__">` document. The mechanism is the documented
one: for a detected crawler Next skips the shell and renders the page dynamically at request
time, and that dynamic path does **not** fall back to the stale `use cache` entry the way the
cached path does.

Two controls were run so the cause is not misattributed:

- **Not an artefact of the isolation helper.** Both configuration-2 routes fail — `/` (raw
  `node:http`) *and* `/viafetch` (plain `fetch` inside `use cache`). It is the `use cache` layer.
- **Not merely "no `<Suspense>` boundary on the bot's dynamic path".** This is the confound worth
  ruling out, because configuration 2 and the hybrid differ in *two* ways at once — cache
  primitive and Suspense placement. So the hybrid's `/direct` (Data Cache, **no** `<Suspense>`,
  `cacheComponents: true`) was rebuilt at `revalidate: 5` and given the same treatment:

  ```
    /direct  (Data Cache, NO Suspense) googlebot -> HTTP 200
    /direct  (Data Cache, NO Suspense) human     -> HTTP 200
    --- 20:16:44Z final GET :3114/direct -> HTTP 200 x-nextjs-cache: STALE
        direct: schools=42 n=4004 err=undefined
  ```

  The bot requests genuinely forced failing revalidations — the `ECONNREFUSED` count in that
  server's log rose from 24 to 42 across three spaced Googlebot requests — and every one still
  returned `200` with the last good payload. **A Data Cache entry serves stale on the crawler
  dynamic-render path; a `use cache` entry does not.** The difference is the primitive, not the
  Suspense boundary.

For a portfolio site whose figures must "stay crawlable", this means: under `use cache`, an
internal-app outage is invisible to visitors and a hard `500` to Google. The previous model and
the hybrid are both unaffected.

---

## Reconciling the Verification debt list

| Debt item | Status |
| --- | --- |
| Whether `use cache` serves stale on a failed revalidation | **Settled — yes.** HTTP 200 and the last good payload across 16 s and four requests, with `DefaultCacheHandler: set … failed ECONNREFUSED` in the log proving the refresh ran and threw. Retries every window; recovers one request after the origin returns. **Caveat: not for crawlers — see below.** |
| Whether the ISR stale-on-error sentence extends to a `fetch` Data Cache entry inside a Cache Components app (*"the highest-value thing to verify"*) | **Settled — yes.** Both `fetch(next:{revalidate})` and `unstable_cache` served last-good under `cacheComponents: true`, and both are prerendered at build. **The hybrid is viable on rule 2 — read that narrowly.** Rule 1 is a separate question and the hybrid does *not* pass it by default: with the origin dead, the `<Suspense>`-wrapped hybrid routes build green and serve `200` with no data (see (e) above). Rule 2 holding is not rule 1 holding. |
| Whether a route re-render skips refetching payloads whose Data Cache entries are still fresh | **Settled — yes, it skips.** `/slow` (revalidate 3600) was fetched once at build and never again across ~15 regenerations of a route with `revalidate = 5`. §4's inference was correct; the blast-radius concern does not arise. |
| Whether the 16.3 web docs' behavioural statements hold in 16.2.12 | **Still open in general**, but every statement this experiment exercised held: `x-nextjs-cache` values, the `cacheLife` preset semantics, `200`-only Data Cache storage, and the `<Suspense>`-forfeits-prerender escape. One **[16.3 web]** claim was *sharpened*: the short-lived-cache exclusion threshold is `expire < 300s`, source-verified as `DYNAMIC_EXPIRE`. |
| Whether a crawler hitting a Cache Components page during an outage gets a failed render | **Settled — yes, and worse than inferred.** Reproducible HTTP `500` to a Googlebot user-agent while humans get `200`. Confirmed absent in the previous model and in the hybrid, so it is specific to `use cache`. |

### Two things the experiment added that were not on the list

- **`expire: Infinity` in a `next.config.ts` `cacheLife` profile is a silent trap** — it does not
  mean "never expire", it drops the payload out of the prerender entirely and forfeits rule 1.
  Use a large finite value. This qualifies §1's "indefinitely" discussion.
- **`<Suspense>` turns a rule-1 build failure into a green build** that serves `200` with no data
  and no warning. The only visible trace is `○` becoming `◐` in the route table.

### Still not settled

- Behaviour **across a deploy** (§5's "indefinitely means until the next deploy") was not tested;
  every run here used a single build ID.
- Multi-instance cache behaviour (§3) was not tested — one instance throughout.
- `revalidateTag` / `revalidatePath` semantics, including `{ expire: 0 }` making the next request a
  blocking revalidate against a dead origin. That is the §3 tension and it remains unmeasured.
- How long stale is served. Runs lasted tens of seconds, well inside `expire`. The claim tested is
  "stale on a failed revalidation", not "stale for a year".
