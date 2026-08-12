/**
 * `@sugt/db` — the schema, the migrations, the connection and the queries.
 *
 * **`@sugt/public` must never declare this package.** That is AGENTS.md rule 1 and
 * the mechanism behind ADR-0002: pnpm's strict symlinked `node_modules` is what makes
 * "internal narrative cannot reach a public page" a fact about the dependency graph
 * rather than a convention held by code review.
 *
 * **The query layer is `@sugt/db/queries`**, a subpath of its own beside `./schema`.
 * Read that module's own comment for the five conventions every query follows — the
 * `Caller` union, one function per surface's payload, and the Staff-only choke point
 * ADR-0011 puts in this package.
 *
 * **This package resolves nobody.** Person resolution is React-aware — it is memoised
 * with React's `cache()` and reads `next/headers` — which this package is not and
 * should not become. It takes a Person it is given.
 */
export { db, type Db } from "./client";
export * as schema from "./schema";
