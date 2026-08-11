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
 * non-Staff caller — but there is no Person-resolution layer until the internal app
 * exists, so a guard written now would have no caller and an invented signature.
 * It arrives with the app.
 */
export { db, type Db } from "./client";
export * as schema from "./schema";
