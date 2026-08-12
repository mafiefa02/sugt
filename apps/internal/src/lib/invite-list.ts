import { db, schema } from "@sugt/db";
import type { Role } from "@sugt/domain";
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
 */

/** Who a request resolves to. `role` is write-once, so nothing re-reads it within a session. */
export type Person = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
};

/** Staff must additionally hold a Google account on this domain. */
export const STAFF_EMAIL_DOMAIN = "@ditsama.itb.ac.id";

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

/**
 * The Staff-domain rule, as a **roster-integrity backstop rather than the working
 * gate**.
 *
 * It is narrower than it looks. The hook that calls this has already found the Person
 * by the Google address presented, so a Staff member whose roster row reads
 * `alice@ditsama.itb.ac.id` signing in with `alice@gmail.com` matches no row at all
 * and is refused as uninvited — this never runs. The only way to reach a `false` here
 * is a roster row that is itself wrong: `role = 'Staff'` against a non-DITSAMA
 * address.
 *
 * So this earns its keep as a last line of defence against a bad row. The place the
 * rule does day-to-day work is validation on the People screen's add form.
 * ADR-0003 is explicit that gating on the domain **alone** would exclude exactly the
 * people Google was chosen for: a professor with no ITB account.
 */
export function satisfiesStaffDomainRule(person: Person): boolean {
  if (person.role !== "Staff") return true;
  return person.email.toLowerCase().endsWith(STAFF_EMAIL_DOMAIN);
}
