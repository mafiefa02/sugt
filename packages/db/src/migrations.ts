/**
 * Where the migration files are, for anything that applies them programmatically.
 *
 * Its own entry point rather than a member of `./index`, because that one is imported
 * by the app at runtime and this is only ever wanted by a test or a provisioning
 * script. Nothing serving a request should be able to reach a filesystem path.
 *
 * The normal way to apply these is `pnpm --filter @sugt/db db:migrate`.
 *
 * `node:url`'s `fileURLToPath` would be the obvious way to write the line below. This
 * package deliberately carries no `@types/node` — `src/client.ts` declares the one
 * `process` shape it needs rather than pull them in — so the URL is decoded by hand
 * instead. POSIX only, which is every environment this runs in.
 */
export const migrationsFolder = decodeURIComponent(
  new URL("../migrations", import.meta.url).pathname,
);
