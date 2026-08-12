import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgSchema,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Identity. Better Auth's `user` is a sign-in credential; **`person` is the human**,
 * and every domain foreign key in this schema points at `person.id`.
 *
 * The reason is concrete: a Group is assembled when a Perjadin is planned, and a
 * professor may be named to it months before they first sign in. A domain that
 * FKs into `user` cannot express that.
 */

/** Matches `ROLES` in `@sugt/domain`, character for character. */
export const ROLE_VALUES = ["Staff", "Teaching Team"] as const;

/**
 * `person` **is** the invite list. There is no separate invite table: a row here is
 * an invitation, and `active = false` is a revocation that preserves every
 * historical reference to that person.
 *
 * `unique (id, role)` looks pointless beside a primary key on `id`. It is not — it
 * is the target of six composite foreign keys elsewhere in this schema, and it is
 * what lets "the PIC is Staff", "only Teaching Team taught a Stream", "only
 * Teaching Team file Class Records" and "only Staff file Session Records" be
 * declarative constraints instead of triggers. **Do not drop it.**
 *
 * None of the six declares `on update`, so all default to `NO ACTION` — which makes
 * `role` **write-once** once a Person has been used anywhere. A wrong role is
 * corrected by revoking the row and creating a new Person, which is why
 * `person_email_key` is partial (`where active`) — see
 * `docs/adr/0013-people-are-added-in-the-tool-and-their-role-is-write-once.md`.
 */
export const person = pgTable(
  "person",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("person_role_check", sql`${t.role} in ('Staff', 'Teaching Team')`),
    /**
     * Case-insensitive, and **partial**: at most one *active* Person per email
     * address, any number of revoked ones.
     *
     * Both halves are load-bearing. Better Auth lowercases the address before the
     * sign-in hooks see it, so the lookup those hooks make is
     * `where lower(email) = $1 and active` — the `lower()` is what makes the first
     * half of that unambiguous, and `where active` is what makes the second half
     * unambiguous. Without the predicate a revoke-and-re-add is impossible, because
     * the revoked row still holds the address.
     */
    uniqueIndex("person_email_key")
      .on(sql`lower(${t.email})`)
      .where(sql`${t.active}`),
    unique("person_id_role_key").on(t.id, t.role),
  ],
);

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
