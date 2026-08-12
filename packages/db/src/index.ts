/**
 * `@sugt/db` — the schema, the migrations and the connection.
 *
 * **`@sugt/public` must never declare this package.** That is AGENTS.md rule 1 and
 * the mechanism behind ADR-0002: pnpm's strict symlinked `node_modules` is what makes
 * "internal narrative cannot reach a public page" a fact about the dependency graph
 * rather than a convention held by code review.
 *
 * Query functions are not here yet. ADR-0011 puts the money choke point in this
 * package — every money-reading query taking the authenticated Person and refusing a
 * non-Staff caller. `@sugt/internal` now resolves that Person, so the signature is no
 * longer invented; the choke point and the `Caller` union around it are still the
 * query layer's own work.
 *
 * **This package resolves nobody.** Person resolution is React-aware — it is memoised
 * with React's `cache()` and reads `next/headers` — which this package is not and
 * should not become. It takes a Person it is given.
 */
export { db, type Db } from "./client";
export * as schema from "./schema";
