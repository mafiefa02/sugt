/**
 * The whole schema. Split by the same areas as `docs/data-model.md`, which is the
 * document this file is a translation of — read that for the reasoning; the comments
 * here carry only what a reader of the code needs at the point of use.
 *
 * Not everything lives here. Two pieces of DDL are hand-written migrations because
 * drizzle-kit cannot express them:
 *
 *   - the DEFERRABLE self-referential foreign key putting the PIC inside their own
 *     Group (Drizzle has no `deferrable` on foreign keys, only on transactions), and
 *   - `better_auth.user.person_id`, which crosses into tables the Better Auth CLI
 *     owns and generates.
 *
 * Both are in `migrations/`, and drizzle-kit leaves them alone because they are not
 * in its snapshot.
 */
export * from "./reference";
export * from "./people";
export * from "./travel";
export * from "./delivery";
export * from "./evaluations";
