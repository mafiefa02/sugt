import { boolean, index, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Better Auth's tables — the sign-in credential, not the human.
 *
 * Its own file rather than a section of `people.ts` because the two change for
 * different reasons: `person` changes when the roster or the domain does, and these
 * change when the library is upgraded. `docs/data-model.md` splits them the same way,
 * into "Two Postgres schemas" and "Identity".
 *
 * The single edge between them — `user.person_id` — points this way round on purpose,
 * so `person` references nothing it does not own.
 */

/**
 * Better Auth's four core tables live in their own Postgres schema.
 *
 * `session` is the single most load-bearing word in `CONTEXT.md` — a teaching
 * occasion at one School — so the library does not get to own it in `public`.
 * Supabase's own `auth` schema belongs to GoTrue, hence a new one rather than a
 * shared one.
 */
export const betterAuth = pgSchema("better_auth");

/**
 * **The four tables are declared here by hand, and they cannot be generated.**
 *
 * The Better Auth CLI emits `pgTable` and only `pgTable` — the string `pgSchema`
 * appears nowhere in its bundle, there is no flag for it, and `auth migrate` refuses
 * the Drizzle adapter outright. What makes hand-declaring them correct rather than a
 * workaround is that the adapter never builds a table-name string: it looks each
 * model up as a key in the object it is handed, so `betterAuth.table("user", …)`
 * emits `better_auth."user"` by itself. Better Auth's own Drizzle documentation
 * sanctions this path — *"modifying the Drizzle schema directly"*.
 *
 * Two consequences for whoever upgrades the library:
 *
 * 1. **The property keys are the library's field names and are not yours to tidy.**
 *    The adapter resolves a field by key lookup, so renaming `emailVerified` to
 *    `email_verified` breaks it at runtime and not at typecheck. The column names
 *    are snake_case because the adapter's `camelCase` option defaults to `false`.
 * 2. **`auth generate` is not a step in any workflow.** It was run once, against
 *    `1.6.27`, and its output is kept verbatim at
 *    `packages/db/reference/better-auth-1.6.27.generated.ts` as the thing to diff a
 *    later version against. Regenerate it on a version bump, diff, and bring any new
 *    column across by hand.
 *
 * Verified against `better-auth@1.6.27`; see
 * `docs/research/better-auth-capabilities.md`, which is a version-pinned snapshot
 * rather than durable documentation.
 */
export const user = betterAuth.table("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),

  /**
   * The one column the domain adds. It is declared here rather than through
   * `user.additionalFields` for two reasons that both bite: the library's field-type
   * vocabulary has no `uuid`, so `additionalFields` would emit `text`, which cannot
   * foreign-key to `person.id uuid`; and the adapter reads columns off this object,
   * so the column has to be here for Better Auth to write it at all.
   *
   * The uniqueness is the invariant "a signed-in user maps to at most one Person".
   * The **foreign key** is not here — drizzle-kit will not write a cross-schema
   * reference, so it is a hand-written migration. See
   * `migrations/0003_link_better_auth_user_to_person.sql`, which also explains why
   * the edge points this way round.
   */
  personId: uuid("person_id").unique(),
});

export const authSession = betterAuth.table(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_userId_idx").on(t.userId)],
);

export const account = betterAuth.table(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("account_userId_idx").on(t.userId)],
);

export const verification = betterAuth.table(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/**
 * What `drizzleAdapter`'s `schema` option is handed. The keys are Better Auth's
 * model names, which is why `session` appears here as a key while the Drizzle export
 * above is called `authSession`: `public.session` is a Session, and two exports
 * called `session` in one schema object is exactly the collision this whole Postgres
 * schema exists to prevent.
 */
export const betterAuthSchema = { user, session: authSession, account, verification };
