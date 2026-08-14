"use server";

import { requirePerson } from "-/lib/person";
import { staffSurface } from "-/lib/staff-surface";
import {
  addPerson,
  revokePerson,
  type AddPersonResult,
  type NewPerson,
  type RevokePersonResult,
} from "@sugt/db/queries";
import { revalidatePath } from "next/cache";

/**
 * **Orang's two writes** — add a Person and revoke one. Both Staff-only, both the same three
 * lines: resolve the Person, hand it to `@sugt/db` through `staffSurface`, return what came back.
 *
 * `staffSurface` turns a Teaching Team caller's `NotStaffError` into a 403 rather than a crash —
 * the enforcement is `requireStaff` inside each write, because a layout does not run before a
 * Server Action. Every other refusal is a value the form places on a field.
 *
 * `revalidatePath` clears the client router cache for the roster the user is looking at, on the
 * outcome that changed it.
 */

export async function addPersonAction(input: NewPerson): Promise<AddPersonResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => addPerson(person, input));
  if (result.outcome === "added") revalidatePath("/orang");
  return result;
}

export async function revokePersonAction(personId: string): Promise<RevokePersonResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => revokePerson(person, personId));
  if (result.outcome === "revoked") revalidatePath("/orang");
  return result;
}
