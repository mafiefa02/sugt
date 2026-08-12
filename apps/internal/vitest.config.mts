import { defineConfig } from "vitest/config";

/**
 * The tests run against a **real Postgres**, local to the developer and to CI, and
 * never against either Supabase project. What they prove is about a cross-schema
 * foreign key, a partial unique index and how a library behaves against real DDL;
 * none of that survives a mock.
 *
 * Point `TEST_DATABASE_URL` somewhere else if `sugt_test` on the default local
 * cluster is not what you want. **The database it names is dropped and rebuilt on
 * every run**, which is why the tests read their own variable and never `DATABASE_URL`
 * — pointing them at the development database by forgetting to set one is a mistake
 * worth making impossible.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://localhost:5432/sugt_test";

// The global setup runs in this process and reads it back.
process.env.TEST_DATABASE_URL = TEST_DATABASE_URL;

export default defineConfig({
  // The same `-/*` alias `tsconfig.json` declares. Vite does not read tsconfig paths.
  resolve: { alias: { "-/": new URL("./src/", import.meta.url).pathname } },
  test: {
    globalSetup: ["./tests/support/migrate-from-empty.ts"],
    /**
     * One worker. Every test file shares one Postgres database and each one truncates
     * it, so two files running at once would delete each other's fixtures.
     */
    fileParallelism: false,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      /**
       * Values, not secrets. The Google ones are never sent anywhere: the tests stub
       * Google's token endpoint at the network boundary, which is the only thing they
       * fake and the only thing a test genuinely cannot reach.
       */
      BETTER_AUTH_SECRET: "test-secret-not-used-outside-vitest",
      BETTER_AUTH_URL: "http://localhost:3001",
      GOOGLE_CLIENT_ID: "test-google-client-id",
      GOOGLE_CLIENT_SECRET: "test-google-client-secret",
    },
  },
});
