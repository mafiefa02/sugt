import { db, schema } from "@sugt/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";

import { requireEnv } from "./env";
import { findActivePersonByEmail, satisfiesStaffDomainRule } from "./invite-list";

/**
 * The one code a rejected visitor's browser ever carries back.
 *
 * Uninvited, revoked, and Staff on a personal Gmail all fail identically, because
 * they fail for the same reason: no matching active Person. `/masuk` renders one
 * Indonesian sentence for **every** value of `?error` and never echoes it, so the
 * indistinguishability is true by construction — this constant only makes the two
 * routes agree on the wire as well.
 *
 * It is a code and not prose on purpose. A thrown message arrives underscored, and
 * Better Auth's built-in error page validates the code against
 * `/^['A-Za-z0-9_-]+$/` and renders `UNKNOWN` on anything else. The Indonesian
 * sentence contains two full stops. The copy stays in the app.
 */
export const REJECTED = "NOT_ON_INVITE_LIST";

/**
 * **`code` is load-bearing and `message` is not interchangeable with it**, because the
 * two hooks below are caught at different depths and each reads a different field:
 *
 * - The invite hook's throw is caught around the user-creation call, which keeps
 *   `message` — so the browser lands at `/masuk?error=NOT_ON_INVITE_LIST`.
 * - The revocation hook's throw escapes to the callback route, whose `catch` redirects
 *   **only when `e.body.code` is set** and otherwise rethrows. Without `code` a revoked
 *   Person would get a 500 instead of the sign-in screen.
 *
 * Verified by driving both paths through the handler, not assumed: `1.6.27` sends both
 * to `/masuk` with a 302 and the same `error` value.
 */
function refuse(): never {
  throw new APIError("FORBIDDEN", { message: REJECTED, code: REJECTED });
}

export const auth = betterAuth({
  baseURL: requireEnv("BETTER_AUTH_URL"),
  secret: requireEnv("BETTER_AUTH_SECRET"),

  /**
   * `@sugt/db` owns the tables; this app owns the auth. The adapter never builds a
   * table-name string — it looks each model up as a key in this object — so the
   * hand-declared `pgSchema("better_auth")` tables emit `better_auth."user"` by
   * themselves. Note the keys are Better Auth's **model** names, which is why
   * `session` here is the Drizzle export called `authSession`.
   */
  database: drizzleAdapter(db, { provider: "pg", schema: schema.betterAuthSchema }),

  user: {
    additionalFields: {
      /**
       * The column is declared on the Drizzle table as a real `uuid`. This entry does
       * something different and also necessary: it **registers the field with the
       * library**, because the adapter builds its insert from Better Auth's own field
       * registry and silently drops anything not in it. `type: "string"` is the
       * nearest thing the library's vocabulary has to a uuid and never reaches the
       * DDL — nothing here issues DDL.
       *
       * `input: false` is what stops a client supplying it. On the OAuth path the
       * library skips every `input: false` field before parsing the provider profile,
       * so Google cannot inject a `person_id` claim either.
       */
      personId: { type: "string", required: false, input: false },
    },
  },

  /** Google only. Email-and-password stays off, which is its default. */
  socialProviders: {
    google: {
      clientId: requireEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    },
  },

  session: {
    /**
     * **Cookie caching stays off.** It is the default, and leaving it alone is a
     * decision rather than an omission.
     *
     * It is no longer load-bearing for revocation: `person` is our table, so the
     * `active` lookup every request makes is a fresh read whatever the session cache
     * does. What is left is that the performance case for turning it on is weak —
     * every request already resolves the Person in order to read `role`, so the
     * round trip the cache would save is being made anyway.
     */
  },

  databaseHooks: {
    user: {
      create: {
        /**
         * **The invite gate.** No active `person` row, no account — and the refusal
         * lands before the insert, so an uninvited Google account leaves no trace in
         * the database at all. That is order rather than rollback: every
         * `create.before` hook runs before the adapter's create is called.
         *
         * It **throws** rather than returning `false`. Returning `false` makes the
         * internal create return `null`, after which the OAuth path reads `.id` off
         * it and dies with a `TypeError` — no user row either way, but by accident
         * and with an unusable error.
         */
        before: async (user) => {
          const person = await findActivePersonByEmail(user.email);
          if (!person) refuse();
          if (!satisfiesStaffDomainRule(person)) refuse();

          return { data: { ...user, personId: person.id } };
        },
      },
    },

    session: {
      create: {
        /**
         * **Revocation, at sign-in.** The hook above fires on user *creation* only: a
         * revoked Person who already has a `better_auth.user` row creates a
         * *session*, not a user, so without this they would obtain a cookie and only
         * be bounced on the next request.
         *
         * Two enforcement points, one authority — `person.active`, read by both. The
         * third is `requirePerson()`, which reads it again on every request.
         */
        before: async (session) => {
          const [identity] = await db
            .select({ email: schema.user.email })
            .from(schema.user)
            .where(eq(schema.user.id, session.userId))
            .limit(1);

          if (!identity) refuse();
          if (!(await findActivePersonByEmail(identity.email))) refuse();
        },
      },
    },
  },

  /**
   * `nextCookies()` must be **last** in this array. Better Auth warns when a plugin
   * declaring `hooks.after` sits after it, because those hooks may set cookies that
   * are never forwarded to Next's cookie store.
   */
  plugins: [nextCookies()],
});
