# Supabase Storage from a Better-Auth app

> **Snapshot, not durable documentation.** Read on **12 August 2026**, with every citation pinned
> to the commit it was read at — necessary because `supabase/storage-js` is archived and the
> canonical source moved into `supabase-js/packages/core/storage-js`, which has since been
> refactored. Limits, error codes and client signatures are all version-dependent; re-verify
> before relying on them.

Research for [issue #8]. The governing constraint is already recorded: sign-in is Better Auth, so
there is no `auth.uid()` in Postgres and **storage policies cannot identify the caller**
([ADR-0011](../adr/0011-supabase-and-better-auth.md), "Object storage" in
[`docs/data-model.md`](../data-model.md)). Receipt access is a signed URL the internal app mints
after checking the caller is Staff. Two buckets: `receipts` (private, keys
`perjadin/{perjadin_id}/{transaction_id}/{uuid}`) and `public-media` (public, keys
`story/{story_id}/{uuid}`).

This answers what the API actually does. **It does not choose the upload architecture** — a
separate ticket does that. Where a choice exists, the trade-off is stated and left open.

## How to read the citations

Nothing here is from memory. Three primary sources, all pinned to the commit read on
**12 August 2026**, because two of them move:

| Source                 | Pinned at                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client (`storage-js`)  | [`supabase-js@6653465`](https://github.com/supabase/supabase-js/tree/6653465c2a35f233ae43d689cbec4c822aaf49de/packages/core/storage-js)            |
| Server (`storage-api`) | [`supabase/storage@1ddcf30`](https://github.com/supabase/storage/tree/1ddcf30bc142707826d2d22f4742521cb2b33907)                                    |
| Docs                   | [`supabase/supabase@6bda113`](https://github.com/supabase/supabase/tree/6bda113bf076be26600f4c237a2a755500b0a353/apps/docs/content/guides/storage) |

**`github.com/supabase/storage-js` is archived and stale.** Its own repository metadata says "The
storage-js repo now has a new home: <https://github.com/supabase/supabase-js/tree/master/packages/core/storage-js>",
last pushed 23 January 2026 (<https://api.github.com/repos/supabase/storage-js>). The canonical
package has since been refactored onto a `BaseApiClient` and gained options the archived copy does
not have. Read the monorepo path, not the old repo.

---

## 1. Minting a signed URL server-side

**The call.** `createSignedUrl(path, expiresIn, options?)` on a `StorageFileApi` bound to a bucket
([`StorageFileApi.ts#L690`](https://github.com/supabase/supabase-js/blob/6653465c2a35f233ae43d689cbec4c822aaf49de/packages/core/storage-js/src/packages/StorageFileApi.ts#L690)):

```js
const { data, error } = await supabase.storage
  .from("bucket")
  .createSignedUrl("private-document.pdf", 3600);
```

That example is the documentation's own
([Serving assets from Storage](https://supabase.com/docs/guides/storage/serving/downloads)). The
resolved value is `{ data: { signedUrl }, error }`; there is a plural
`createSignedUrls(paths, expiresIn, options?)` that returns one `{ error, path, signedUrl }` row per
path ([`#L785`](https://github.com/supabase/supabase-js/blob/6653465c2a35f233ae43d689cbec4c822aaf49de/packages/core/storage-js/src/packages/StorageFileApi.ts#L785)).

**Expiry is in seconds, and it can be very short.** The client's own doc comment: "The number of
seconds until the signed URL expires. For example, `60` for a URL which is valid for one minute."
The server validates it as `{ type: 'integer', minimum: 1 }`
([`getSignedURL.ts`](https://github.com/supabase/storage/blob/1ddcf30bc142707826d2d22f4742521cb2b33907/src/http/routes/object/getSignedURL.ts))
and then again in `assertValidNumericJWTExpiration`, which rejects anything not a safe integer,
below `1`, or beyond `MAX_SAFE_INTEGER / 1000` seconds from now
([`jwt.ts`](https://github.com/supabase/storage/blob/1ddcf30bc142707826d2d22f4742521cb2b33907/src/internal/auth/jwt.ts)).
**There is no documented lower bound above one second** — a 30-second URL is a legal call.

**What the URL is.** `signObjectUrl` first does `await this.findObject(objectName)` — so signing a
key that does not exist fails rather than producing a URL — then signs a JWT with a **separate
`urlSigningKey`**, and returns `/object/sign/{bucket}/{path}?token={jwt}`
([`object.ts#L730`](https://github.com/supabase/storage/blob/1ddcf30bc142707826d2d22f4742521cb2b33907/src/storage/object.ts#L730)).
The docs confirm the key separation: "Storage signed URLs are signed with a dedicated internal key
that is separate from your project's Auth JWT signing key… Signed URLs remain valid until their
expiry time regardless of any Auth key changes"
([downloads](https://supabase.com/docs/guides/storage/serving/downloads)).

**What an attacker gets if the URL is forwarded before it expires.** All of it, and the answer is
not softened by anything:

- **The bytes, with no credential of their own.** `GET /object/sign/:bucketName/*` declares
  `required: ['token']` and no `authorization` header at all, verifies the token, and then reads
  the row `asSuperUser()`
  ([`getSignedObject.ts`](https://github.com/supabase/storage/blob/1ddcf30bc142707826d2d22f4742521cb2b33907/src/http/routes/object/getSignedObject.ts)).
  The URL _is_ the credential. Whoever holds it is Staff for that object.
- **The object path, in clear.** The token payload is `{ url: '<bucket>/<path>', scope, iat, exp }`
  ([`object.ts#L730`](https://github.com/supabase/storage/blob/1ddcf30bc142707826d2d22f4742521cb2b33907/src/storage/object.ts#L730)),
  and a JWT payload is base64url, not encrypted. The docs' own worked example decodes to
  `{"url":"avatars/folder/cat.png","iat":…,"exp":…}`. Under the key convention in
  `docs/data-model.md` the recipient therefore learns the `perjadin_id` and `transaction_id`
  without fetching anything. See §6.
- **Nothing beyond that one object.** `verifyObjectSignature` rejects the token unless
  `payload.url === '<bucketId>/<objectName>'` for the path actually requested, and unless the
  token's `scope` matches
  ([`object.ts#L877`](https://github.com/supabase/storage/blob/1ddcf30bc142707826d2d22f4742521cb2b33907/src/storage/object.ts#L877)).
  `signObjectUrl` additionally deletes `role`, `upsert` and `owner` from caller-supplied metadata
  before signing, commented in-source as "security-in-depth: as signObjectUrl could be used as a
  signing oracle". A download token cannot be turned into an upload token.
- **It cannot be taken back.** "If you need to revoke signed URLs, contact Supabase support"
  ([downloads](https://supabase.com/docs/guides/storage/serving/downloads)). There is no revoke
  call. Expiry is the only control, which is the argument for making it short.

One caching consequence: the signed-download route sets the response's `expires` to the token's
`exp` (`expires: new Date(exp * 1000).toUTCString()` in `getSignedObject.ts`), so an intermediary
may hold the body up to that instant and no further.

---

## 2. Uploading: direct server-side upload vs a signed upload URL

**Both patterns keep the service-role key on the server.** That is the honest answer and it is easy
to state wrongly. The discriminator is not key exposure — it is **whether the bytes pass through a
Vercel function**.

### (a) Direct server-side upload

```js
// Server Action or route handler, service-role client
const { data, error } = await supabase.storage
  .from("receipts")
  .upload(`perjadin/${perjadinId}/${transactionId}/${crypto.randomUUID()}`, file, {
    contentType: "image/jpeg",
    upsert: false,
  });
```

`upload(path, fileBody, fileOptions?)` resolves to `{ data: { id, path, fullPath }, error }`
([`#L220`](https://github.com/supabase/supabase-js/blob/6653465c2a35f233ae43d689cbec4c822aaf49de/packages/core/storage-js/src/packages/StorageFileApi.ts#L220);
[standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)). The browser
posts the file to your app; your app posts it to Storage. The key is chosen server-side, so it
cannot be forged.

**The cost is two body limits, stacked.**

- **Next.js caps Server Action bodies at 1 MB by default.** "By default, the maximum size of the
  request body sent to a Server Action is 1MB… you can configure this limit using the
  `serverActions.bodySizeLimit` option. It can take the number of bytes or any string format
  supported by bytes, for example `1000`, `'500kb'` or `'3mb'`", set under `experimental` in
  `next.config.js` ([serverActions](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions);
  this repo is on `next: 16.2.12` per `pnpm-workspace.yaml`). The same page notes the limit is on
  the **raw** body including multipart boundaries and part headers, so budget ~10–20 KB of
  overhead. **Next documents this limit only for Server Actions**, and the option is named for
  them; nothing on that page extends it to route handlers. That is an argument from silence, so
  treat "a route handler escapes the 1 MB default" as likely rather than cited — and note it
  changes little, because the platform cap below binds either way.
- **Vercel caps every function at 4.5 MB regardless.** "The maximum payload size for the request
  body or the response body of a Vercel Function is **4.5 MB**. If a Vercel Function receives a
  payload in excess of the limit it will return an error 413: `FUNCTION_PAYLOAD_TOO_LARGE`"
  ([Vercel Functions Limits](https://vercel.com/docs/functions/limitations)). Raising
  `bodySizeLimit` above 4.5 MB buys nothing; the platform limit binds first, and it binds on route
  handlers too.

So this pattern's practical ceiling is ~4.5 MB per upload, and Supabase independently recommends
resumable uploads above 6 MB anyway: "The standard file upload method is ideal for small files that
are not larger than 6MB… we recommend using TUS Resumable Upload for uploading files greater than
6MB" ([standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)).

### (b) Signed upload URL

```js
// server: after the Staff check
const { data } = await supabase.storage
  .from("receipts")
  .createSignedUploadUrl(`perjadin/${perjadinId}/${transactionId}/${crypto.randomUUID()}`);
// -> { signedUrl, token, path }

// browser:
const { data, error } = await supabase.storage
  .from("receipts")
  .uploadToSignedUrl(path, token, file);
```

Both signatures are from the client
([`createSignedUploadUrl` #L381](https://github.com/supabase/supabase-js/blob/6653465c2a35f233ae43d689cbec4c822aaf49de/packages/core/storage-js/src/packages/StorageFileApi.ts#L381),
[`uploadToSignedUrl` #L275](https://github.com/supabase/supabase-js/blob/6653465c2a35f233ae43d689cbec4c822aaf49de/packages/core/storage-js/src/packages/StorageFileApi.ts#L275)).
The browser holds a token scoped to **one path**, not a key.

Three things worth knowing before this looks strictly better:

- **The upload-URL lifetime is not a parameter.** The client documents "They are valid for 2 hours"
  ([#L347](https://github.com/supabase/supabase-js/blob/6653465c2a35f233ae43d689cbec4c822aaf49de/packages/core/storage-js/src/packages/StorageFileApi.ts#L347)),
  and the server takes it from its own config, `uploadSignedUrlExpirationTime`, never from the
  request ([`getSignedUploadURL.ts`](https://github.com/supabase/storage/blob/1ddcf30bc142707826d2d22f4742521cb2b33907/src/http/routes/object/getSignedUploadURL.ts),
  [`config.ts#L390`](https://github.com/supabase/storage/blob/1ddcf30bc142707826d2d22f4742521cb2b33907/src/config.ts#L390)).
  That config line's **self-host fallback is `60` seconds**; the hosted platform sets the 2 hours
  the client documents, so do not read the source as contradicting the docstring. Either way the
  value is the server's, not yours — unlike `createSignedUrl`, you cannot make it short.
- **`upsert` is decided when the URL is minted, not when it is used.** "The `upsert` option has no
  effect here. To enable upsert behavior, pass `{ upsert: true }` when calling
  `createSignedUploadUrl()` instead"
  ([#L246](https://github.com/supabase/supabase-js/blob/6653465c2a35f233ae43d689cbec4c822aaf49de/packages/core/storage-js/src/packages/StorageFileApi.ts#L246)).
  Left at the default `false`, a leaked token can write the object once and no more.
- **Your server never sees the bytes**, which is the point and also the bill: `content_type` and
  `byte_size` then have to come from somewhere other than the request. See §5.

### The trade-off, stated and left open

|                                 | Server-side `upload()`                              | `createSignedUploadUrl` + `uploadToSignedUrl`  |
| ------------------------------- | --------------------------------------------------- | ---------------------------------------------- |
| Service-role key on the client  | No                                                  | No                                             |
| Bytes through a Vercel function | Yes — 4.5 MB hard, 1 MB default via a Server Action | No — browser talks to Storage directly         |
| Key chosen by                   | Server                                              | Server (the token is bound to that exact path) |
| Window the browser holds        | none                                                | fixed 2 hours, not configurable per call       |
| Server can inspect the bytes    | Yes                                                 | No                                             |
| `content_type` / `byte_size`    | Server can measure                                  | Must be read back (§5)                         |

Neither column is recommended here.

---

## 3. What bucket policies are still required

**None, for either bucket, in an arrangement where every access goes through the app's own
service-role credentials.**

**The service role bypasses RLS, and the mechanism is visible in the source.** The docs say it
plainly: "If you exclusively use Storage from trusted clients, such as your own servers, and need
to bypass the RLS policies, you can use the `service key` in the `Authorization` header. Service
keys entirely bypass RLS policies, granting you unrestricted access to all Storage APIs"
([access control](https://supabase.com/docs/guides/storage/security/access-control)). Underneath,
`storage-api` opens each transaction with
`set_config('role', $1, true), set_config('request.jwt.claim.role', $2, true), …` where the value
is `options.user.payload.role || 'anon'` — the `role` claim of the key you presented
([`scope.ts#L13`](https://github.com/supabase/storage/blob/1ddcf30bc142707826d2d22f4742521cb2b33907/src/internal/database/postgres/scope.ts#L13),
[`pg-connection.ts`](https://github.com/supabase/storage/blob/1ddcf30bc142707826d2d22f4742521cb2b33907/src/internal/database/pg-connection.ts)).
A service-role key makes the Postgres role `service_role`, and policies on `storage.objects` are
not evaluated for it. This is the storage-layer twin of ADR-0011's "therefore no RLS".

**So a private bucket with zero policies is not a gap — it is the correct configuration.** "By
default Storage does not allow any uploads to buckets without RLS policies"
([access control](https://supabase.com/docs/guides/storage/security/access-control)); with no
policies, `anon` and `authenticated` can do nothing at all to `receipts`, which is exactly the
posture ADR-0011 wants. Adding a policy could only widen it. This also preserves ADR-0011's "no
anon-role policy is ever needed anywhere" at the storage layer.

Two clarifications that matter when reading other people's Supabase advice:

- **`public-media` being public buys read only.** "When a bucket is designated as 'Public,' it
  effectively bypasses access controls for both retrieving and serving files… Access control is
  still enforced for other types of operations including uploading, deleting, moving, and copying"
  ([buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)). Writes to
  `public-media` still need a credential — the service role supplies it, so again no policy.
- **The signed-URL routes do their own bypassing.** Reading through a signed download URL and
  writing through a signed upload URL both call `asSuperUser()` after verifying the token
  (`getSignedObject.ts`, `uploadSignedObject.ts`). A policy would not be consulted on those paths
  even if one existed.

The policy tables Supabase documents — `(storage.foldername(name))[1] = …`,
`auth.jwt()->>'sub' = owner_id` ([access control](https://supabase.com/docs/guides/storage/security/access-control))
— are all predicated on a Supabase Auth JWT. They are unbuildable here, which is the premise, not a
surprise.

---

## 4. The public URL for `public-media`, and `next/image`

**The URL shape is documented and stable:**

```
https://[project_id].supabase.co/storage/v1/object/public/[bucket]/[asset-name]
```

([serving assets](https://supabase.com/docs/guides/storage/serving/downloads)). For a Story
photograph that is
`https://{ref}.supabase.co/storage/v1/object/public/public-media/story/{story_id}/{uuid}`.
`getPublicUrl(path)` just concatenates it — the client builds the string by `encodeURI` over
`{storageUrl}/{renderPath}/public/{bucketId}/{path}`, with `renderPath` of `object`, or
`render/image` when transform options are passed
([#L1086](https://github.com/supabase/supabase-js/blob/6653465c2a35f233ae43d689cbec4c822aaf49de/packages/core/storage-js/src/packages/StorageFileApi.ts#L1086)).
Its own doc comment notes it "does not verify if the bucket is public", and its RLS remarks read
"`buckets` table permissions: none / `objects` table permissions: none". Public objects are also
the CDN-friendly case: "Objects in public buckets do not require any authorization to access
objects. This leads to a better cache hit rate compared to private buckets"
([CDN](https://supabase.com/docs/guides/storage/cdn/fundamentals)).

**`next/image` can optimise from it,** because the URL needs no headers — and headers are precisely
what the optimiser will not send: "For security reasons, the Image Optimization API using the
default loader will _not_ forward headers when fetching the `src` image. If the `src` image
requires authentication, consider using the `unoptimized` property"
([Image](https://nextjs.org/docs/app/api-reference/components/image)). A public-bucket URL needs
none. A **signed** URL would also technically fetch, but see the caveat below.

**What `remotePatterns` must allow.** Scope it to the bucket prefix, not the host:

```js
// next.config.js — @sugt/public
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "<project-ref>.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/public-media/**",
        search: "",
      },
    ],
  },
};
```

The docs give this object shape verbatim and describe the semantics: the `src` "must start with
`https://example.com/account123/` and must not have a query string. Any other protocol, hostname,
port, or unmatched path will respond with `400` Bad Request"; `**` matches "any number of path
segments at the end… This syntax does not work in the middle of the pattern"; and "When omitting
`protocol`, `port`, `pathname`, or `search` then the wildcard `**` is implied. This is not
recommended because it may allow malicious actors to optimize urls you did not intend"
([remotePatterns](https://nextjs.org/docs/app/api-reference/components/image#remotepatterns)). So
`pathname` and `search` are load-bearing; omitting them is the documented mistake.

**Does allowing it expose anything beyond the intended objects?** Not the receipts, and not by
accident:

- A pattern anchored at `/storage/v1/object/public/public-media/` cannot match
  `/storage/v1/object/sign/receipts/…` or `/storage/v1/object/authenticated/…` — different path
  prefixes, and `**` only extends the end. Private objects stay unreachable through `/_next/image`.
- What it _does_ create is a **proxy**: your own `/_next/image` endpoint will fetch and re-serve
  anything matching the pattern, for anyone who can construct the query string. Narrowed to that
  one bucket prefix, "anything" is exactly the set of objects that are already world-readable by
  design — which is the whole point of `public-media` per ADR-0001. Left as a bare `hostname`, it
  would also cover every other public bucket the project ever gains.
- One caching note if a signed URL is ever passed to `next/image` instead: optimised images are
  cached for `minimumCacheTTL` (14400 s on the docs page as fetched, which documents 16.3.0 while
  this repo is on 16.2.12 — the argument holds at any nonzero TTL) or the upstream `Cache-Control`,
  whichever is larger, and "There is no mechanism to invalidate the cache at this time"
  ([Image config](https://nextjs.org/docs/app/api-reference/components/image)). A 60-second signed
  URL optimised through `/_next/image` can therefore outlive its own expiry as a cached derivative.
  Another reason receipts do not belong in `next/image`.

Note also that `@sugt/public` holding no Supabase client (ADR-0011, AGENTS.md rule 1) is untouched
by any of this: a `remotePatterns` entry is a string in a config file, not a dependency.

---

## 5. Size limits, content types, and what a rejected upload returns

**Limits are set in two places, and both are enforced server-side on every upload path.**

- **Global**, per project: "You can set the maximum file size across all your buckets by setting
  the _Global file size limit_ value in your Storage Settings. For Free projects, the limit can't
  exceed 50 MB. On the Pro Plan and up, you can set this value to up to 500 GB"
  ([limits](https://supabase.com/docs/guides/storage/uploads/file-limits)).
- **Per bucket**: `file_size_limit` (bytes) and `allowed_mime_types` (a `text[]`), columns on
  `storage.buckets` ([storage schema](https://supabase.com/docs/guides/storage/schema/design)),
  settable at creation via `createBucket(id, { public, fileSizeLimit, allowedMimeTypes })`, which
  the client sends as `file_size_limit` / `allowed_mime_types`
  ([`StorageBucketApi.ts`](https://github.com/supabase/supabase-js/blob/6653465c2a35f233ae43d689cbec4c822aaf49de/packages/core/storage-js/src/packages/StorageBucketApi.ts)).
  A per-bucket limit "can't be higher than this global limit"
  ([limits](https://supabase.com/docs/guides/storage/uploads/file-limits)).

Enforcement is not client-side courtesy. `uploadFromRequest` loads
`'id, file_size_limit, allowed_mime_types'` from the bucket and hands them to the request parser
([`object.ts#L88`](https://github.com/supabase/storage/blob/1ddcf30bc142707826d2d22f4742521cb2b33907/src/storage/object.ts#L88)),
which calls `validateMimeType` when the bucket lists any, and throws `EntityTooLarge` when
`content-length` exceeds the cap or the stream does
([`uploader.ts#L305`, `#L531`, `#L156`](https://github.com/supabase/storage/blob/1ddcf30bc142707826d2d22f4742521cb2b33907/src/storage/uploader.ts)).
**Crucially this is the same code path for signed-URL uploads** — `uploadSignedObject.ts` calls
`uploadFromRequest` too — so bucket limits still bind when the browser uploads directly and your
server never sees the file.

**What a rejection returns.** JSON `{ "code": "…", "message": "…" }` with these statuses
([error codes](https://supabase.com/docs/guides/storage/debugging/error-codes)):

| Code                                         | HTTP | When                                                       |
| -------------------------------------------- | ---- | ---------------------------------------------------------- |
| `EntityTooLarge`                             | 413  | over the bucket or global size limit                       |
| `InvalidMimeType`                            | 400  | not in the bucket's `allowed_mime_types`                   |
| `InvalidKey`                                 | 400  | key fails `isValidKey` (see §6)                            |
| `KeyAlreadyExists` / `ResourceAlreadyExists` | 409  | path taken and `upsert` is false                           |
| `AccessDenied`                               | 403  | no policy permits it (not reachable with the service role) |
| `NoSuchBucket` / `NoSuchKey`                 | 404  | bucket or object missing                                   |

Through the JS client these surface as `{ data: null, error }` rather than a throw, unless
`throwOnError()` is set.

**Where `content_type` and `byte_size` should come from.** Both tables store them as facts about a
file already accepted — so the defensible source is **what Storage accepted, read back from the
API**, not what the browser claimed.

- `info(path)` returns `FileObjectV2`, which carries `size?: number`, `content_type?: string`,
  `etag`, `cache_control` and `last_modified`
  ([`#L950`](https://github.com/supabase/supabase-js/blob/6653465c2a35f233ae43d689cbec4c822aaf49de/packages/core/storage-js/src/packages/StorageFileApi.ts#L950);
  [types.ts](https://github.com/supabase/supabase-js/blob/6653465c2a35f233ae43d689cbec4c822aaf49de/packages/core/storage-js/src/lib/types.ts)).
  `list()` also exposes per-object `metadata`.
- This matters most under the signed-upload-URL pattern, where the server has **nothing else** to
  write into the row. It is the seam between §2 and this section: choosing (b) means committing to
  a read-back before the `INSERT`.
- Content type is inferred unless you say otherwise: "By default, Storage will assume the content
  type of an asset from the file extension. If you want to specify the content type for your asset,
  pass the `contentType` option during upload"
  ([standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)). The
  client's default for a non-`Blob`/`File`/`FormData` body is `text/plain;charset=UTF-8`
  ([`types.ts` `FileOptions`](https://github.com/supabase/supabase-js/blob/6653465c2a35f233ae43d689cbec4c822aaf49de/packages/core/storage-js/src/lib/types.ts)),
  which is a trap for a `Buffer` upload from a route handler.
- Undocumented but present in the source: `POST /object/upload/sign/…` reads `content-type` and
  `content-length` request headers and bakes them into the token's metadata
  ([`getSignedUploadURL.ts`](https://github.com/supabase/storage/blob/1ddcf30bc142707826d2d22f4742521cb2b33907/src/http/routes/object/getSignedUploadURL.ts)).
  **`createSignedUploadUrl` in the JS client sends neither** — it sends only `x-upsert`
  ([#L381](https://github.com/supabase/supabase-js/blob/6653465c2a35f233ae43d689cbec4c822aaf49de/packages/core/storage-js/src/packages/StorageFileApi.ts#L381)).
  Pinning a mime type into the token therefore means calling the REST endpoint directly, and that
  is an undocumented server behaviour to depend on.

---

## 6. Does anything argue for a different key convention?

**Supabase does treat `/` specially — more than "folders are virtual".** Since migration
`0026-objects-prefixes`, `storage.objects` has a `level int` column computed as
`array_length(string_to_array(name, '/'), 1)`, and there is a real `storage.prefixes` table keyed
`(bucket_id, level, name)` into which **every intermediate prefix of every object is materialised**
by `storage.add_prefixes` / `storage.get_prefixes`
([`0026-objects-prefixes.sql`](https://github.com/supabase/storage/blob/1ddcf30bc142707826d2d22f4742521cb2b33907/migrations/tenant/0026-objects-prefixes.sql),
[`0029-create-prefixes.sql`](https://github.com/supabase/storage/blob/1ddcf30bc142707826d2d22f4742521cb2b33907/migrations/tenant/0029-create-prefixes.sql)).
So `perjadin/{p}/{t}/{uuid}` writes three prefix rows (`perjadin`, `perjadin/{p}`,
`perjadin/{p}/{t}`) alongside the object; `story/{s}/{uuid}` writes two.

**The sharper finding is the lock.** `storage.lock_top_prefixes` takes
`pg_advisory_xact_lock(hashtextextended(bucket || '/' || split_part(name, '/', 1)))` — an advisory
lock on the **first path segment** — and the object delete/update cleanup triggers call it
([`0040-fix-prefix-race-conditions-optimized.sql`](https://github.com/supabase/storage/blob/1ddcf30bc142707826d2d22f4742521cb2b33907/migrations/tenant/0040-fix-prefix-race-conditions-optimized.sql)).
Because every receipt key begins `perjadin` and every photograph key begins `story`, **the whole
bucket shares one top-level segment and therefore one lock** for those operations. At this
programme's write volume — a handful of receipts per Perjadin — that is theoretical. It is the one
mechanical argument a wider first segment (say `{perjadin_id}/…`) would answer, and it is worth
knowing exists rather than discovering it later.

**Three things that do _not_ argue for a change:**

- **Listing performance is irrelevant here.** `storage_path` is `unique` in `transaction_evidence`
  and `story_photo`, so our own tables are the index; the app never needs `list()`. The prefix
  machinery above exists to make `list()` fast, and we do not call it. (`storage.prefixes` also has
  RLS enabled, which is another thing the service role makes moot — §3.)
- **The characters are legal.** `isValidKey` allows `\w`, `/`, and a set including `-`, `.`, `!`,
  `*`, `'`, `(`, `)`, space, `&`, `$`, `@`, `=`, `;`, `:`, `+`, `,`, `?`
  ([`limits.ts#L91`](https://github.com/supabase/storage/blob/1ddcf30bc142707826d2d22f4742521cb2b33907/src/storage/limits.ts#L91)),
  which the docs restate as the file-name restrictions
  ([limits](https://supabase.com/docs/guides/storage/uploads/file-limits)). UUIDs and `/` are
  squarely inside it. `mustBeValidKey` runs on upload
  ([`object.ts`](https://github.com/supabase/storage/blob/1ddcf30bc142707826d2d22f4742521cb2b33907/src/storage/object.ts)),
  so a bad key is a `400 InvalidKey`, not a silent write.
- **Depth itself is cheap.** Nothing in the source penalises four segments over two beyond the one
  extra `storage.prefixes` row per level.

**One thing that genuinely does.** §1 established that the signed URL's token is a readable JWT
containing `'<bucket>/<path>'`. A structured key **leaks its structure to whoever the URL is
forwarded to**: `perjadin/{perjadin_id}/{transaction_id}/{uuid}` tells the recipient which trip and
which transaction, and lets them correlate two forwarded receipts as belonging to the same
Perjadin. An opaque key (`{uuid}` alone, or a single hashed segment) would leak nothing but the
bucket. Weigh that against what the structured prefix buys — it is the readable, greppable audit
trail that makes an orphan object identifiable, and it makes the cascade in
`docs/data-model.md`'s "What deleting a Perjadin does" checkable by prefix. Both are real; this
document does not pick.

**One hazard to encode either way.** `_removeEmptyFolders` runs `path.replace(/^\/|\/$/g, '')
.replace(/\/+/g, '/')` before upload
([#L1506](https://github.com/supabase/supabase-js/blob/6653465c2a35f233ae43d689cbec4c822aaf49de/packages/core/storage-js/src/packages/StorageFileApi.ts#L1506)).
An `undefined` or empty id interpolated into the template collapses `//` into `/` and silently
produces a _shorter, different, still-valid_ key rather than an error. Keys must be assembled from
ids already known to be non-empty.

---

## What this does not settle

- **Which upload pattern to use** — §2 states the trade-off; issue-scope says another ticket
  decides.
- **Whether `receipts` should carry a bucket-level `allowedMimeTypes`.** §5 shows it is enforced on
  every path including signed uploads, which makes it attractive; the list itself is a product
  question (are PDFs evidence, or only photographs?).
- **The `public-media` cache-control value.** The client defaults to `3600`
  ([`FileOptions`](https://github.com/supabase/supabase-js/blob/6653465c2a35f233ae43d689cbec4c822aaf49de/packages/core/storage-js/src/lib/types.ts));
  a photograph that "has to come down now" (`docs/data-model.md`, Stories) interacts with both the
  Supabase CDN and `next/image`'s uninvalidatable cache, and that is worth its own look when
  unpublishing is built.

[issue #8]: https://github.com/mafiefa02/sugt/issues/8
