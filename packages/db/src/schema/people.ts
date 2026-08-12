import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
