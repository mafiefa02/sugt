import { defineConfig } from "vitest/config";

/**
 * `@sugt/public` holds no database and no Supabase client, so unlike `@sugt/internal` its tests need
 * no Postgres and no migration setup. What is worth testing here is the seam logic: the revalidation
 * route's gate, the aggregates fetch wrapper's throw-on-error and version check (ADR-0014), the
 * derived figures, and that the Story-body renderer honours the allowlist (ADR-0015). `next/cache`
 * and `global.fetch` are mocked where used, so nothing real is touched.
 *
 * This suite is **not** part of the repo-wide gate (`pnpm --filter @sugt/internal test`); run it
 * with `pnpm --filter @sugt/public test`.
 */
export default defineConfig({
  // The same `-/*` alias `tsconfig.json` declares. Vite does not read tsconfig paths.
  resolve: { alias: { "-/": new URL("./src/", import.meta.url).pathname } },
  test: {
    env: {
      // Values, not secrets. The tests compare against them; nothing is sent anywhere.
      REVALIDATE_SECRET: "test-revalidate-secret",
      INTERNAL_APP_URL: "http://internal.test",
      AGGREGATES_SECRET: "test-aggregates-secret",
    },
  },
});
