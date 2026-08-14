import { defineConfig } from "vitest/config";

/**
 * `@sugt/public` holds no database and no Supabase client, so unlike `@sugt/internal` its tests need
 * no Postgres and no migration setup. The one thing worth testing here is the revalidation route's
 * gate — a wrong or missing `REVALIDATE_SECRET` must revalidate nothing — and `next/cache` is
 * mocked in the test, so nothing real is touched.
 *
 * This suite is **not** part of the repo-wide gate (`pnpm --filter @sugt/internal test`); run it
 * with `pnpm --filter @sugt/public test`.
 */
export default defineConfig({
  // The same `-/*` alias `tsconfig.json` declares. Vite does not read tsconfig paths.
  resolve: { alias: { "-/": new URL("./src/", import.meta.url).pathname } },
  test: {
    env: {
      // A value, not a secret. The test compares against it; nothing is sent anywhere.
      REVALIDATE_SECRET: "test-revalidate-secret",
    },
  },
});
