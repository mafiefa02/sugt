import { db, schema } from "@sugt/db";
import type { Person } from "@sugt/db/queries";
import { and, eq, sql } from "drizzle-orm";

/**
 * The invite list, and the one lookup against it.
 *
 * `person` **is** the invite list — there is no separate invite table. A row is an
 * invitation and `active = false` is a revocation that preserves every historical
 * reference to that Person. See
 * `docs/adr/0003-google-sign-in-with-an-invite-list.md`.
 *
 * This module holds the lookup rather than `auth.ts` because **three** places need
 * it and none of them may disagree: the invite hook at user creation, the revocation
 * hook at session creation, and `requirePerson()` on every request.
 *
 * **Why a query lives in the app rather than in `@sugt/db`.** AGENTS.md rule 3 sends
 * stored data to `@sugt/db`, and this is the one deliberate exception. `@sugt/db`'s
 * query layer takes a `Person` it is given and never resolves one — resolving is what
 * produces the caller its queries are checked against, so it cannot itself be one of
 * them. The two Better Auth hooks are the other reason: they run inside the library's
 * request handling, before anything has a `Person` to be given.
 *
 * **The `Person` type itself is `@sugt/db`'s**, imported below rather than declared
 * here. It has to be: it is the argument every query in that package takes, so a
 * second declaration on this side would be two types that are only equal by accident.
 * The lookup stays here; the shape belongs beside its consumers. This function is the
 * one thing in either app that produces one, which is what makes
 * [#25](https://github.com/mafiefa02/sugt/issues/25)'s *"constructing a `Person`
 * caller requires an active Person"* true.
 */

export type { Person };

/**
 * `where lower(email) = $1 and active`.
 *
 * Both halves matter. Better Auth lowercases the address before any hook sees it, so
 * the comparison is against a lowered column. `active` is the **whole revocation
 * mechanism**: a revoked Person resolves to nothing here, and every one of the three
 * call sites reads that. `person_email_key` is partial (`where active`), which makes
 * "at most one match" a fact about the schema rather than a convention.
 */
export async function findActivePersonByEmail(email: string): Promise<Person | null> {
  const [person] = await db
    .select({
      id: schema.person.id,
      fullName: schema.person.fullName,
      email: schema.person.email,
      role: schema.person.role,
    })
    .from(schema.person)
    .where(
      and(
        sql`lower(${schema.person.email}) = ${email.toLowerCase()}`,
        eq(schema.person.active, true),
      ),
    )
    .limit(1);

  return (person as Person | undefined) ?? null;
}
