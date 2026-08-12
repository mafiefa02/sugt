import { db, schema } from "@sugt/db";
import { sql } from "drizzle-orm";

export type PersonFixture = {
  fullName: string;
  email: string;
  role: "Staff" | "Teaching Team";
  active?: boolean;
};

/** Put a Person on the invite list. A row **is** the invitation. */
export async function addPerson(fixture: PersonFixture) {
  const [person] = await db
    .insert(schema.person)
    .values({
      fullName: fixture.fullName,
      email: fixture.email,
      role: fixture.role,
      active: fixture.active ?? true,
    })
    .returning();
  return person!;
}

/** Revoke a Person. One write — this is the whole revocation mechanism. */
export async function revokePerson(id: string) {
  await db
    .update(schema.person)
    .set({ active: false })
    .where(sql`${schema.person.id} = ${id}`);
}

/** Every `better_auth.user` row. The invite gate's job is to leave this empty. */
export async function authUsers() {
  return db.select().from(schema.user);
}

/** Every `better_auth.session` row. */
export async function authSessions() {
  return db.select().from(schema.authSession);
}

/** Each test starts from a known set of `person` rows and leaves none behind. */
export async function resetDatabase() {
  await db.execute(sql`
    truncate
      better_auth."user",
      better_auth."session",
      better_auth."account",
      better_auth."verification",
      public."person"
    restart identity cascade
  `);
}
