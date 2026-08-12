import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "./auth";
import { findActivePersonByEmail, type Person } from "./invite-list";

export type { Person };

/**
 * Who is asking. Three layers, and the memoisation sits in the middle one — which
 * matters and is easy to get subtly wrong.
 *
 *   1. `resolvePerson(headers)` — the pure resolution function. All the logic, no
 *      Next.js. This is the seam the tests drive.
 *   2. `currentPerson()` — one zero-argument function wrapped in React's `cache()`,
 *      which reads `next/headers` and delegates to the first.
 *   3. `requirePerson()` and `getPerson()` — both calling *that same* memoised
 *      function. Only the throw differs between them.
 *
 * **Both wrappers share one `cache()` entry rather than having one each.** Memoising
 * them separately would make a page that calls both take two round trips, which is
 * the whole reason the memoisation exists. Memoising `resolvePerson` directly does not
 * work either: `cache()` keys on argument identity, so it would only dedupe if
 * `headers()` happened to return a stable reference — not something to build on.
 */

/**
 * Resolve the Better Auth session and join to `person` on `active`, in one call.
 *
 * **The `active` predicate is not a detail — it is the revocation mechanism.** A
 * revoked Person resolves to nothing here on every request, including one they are
 * already mid-session for. `person` is our table, so this is a fresh read whatever
 * the library's session cache does.
 *
 * Two rows can share an address once one of them is revoked, and this deliberately
 * follows the *active* one rather than `user.person_id`: that column is pinned when
 * the sign-in identity is created, so after a revoke-and-re-add it names the dead row.
 * The address is what the invite list is keyed on, and it is what all three
 * enforcement points read.
 */
export async function resolvePerson(requestHeaders: Headers): Promise<Person | null> {
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;

  return findActivePersonByEmail(session.user.email);
}

/** The memoised read. One entry per request, shared by both callers below. */
const currentPerson = cache(async (): Promise<Person | null> => {
  return resolvePerson(await headers());
});

/**
 * The current Person, or a thrown error.
 *
 * Every caller inside the signed-in layout tree has already passed the layout's own
 * check, so a null here is a bug — and a constraint that can only fire from a bug must
 * **not** get a friendly path, or somebody eventually builds a form that relies on it.
 */
export async function requirePerson(): Promise<Person> {
  const person = await currentPerson();
  if (!person) {
    throw new Error(
      "requirePerson() found no active Person. Inside the signed-in tree this cannot " +
        "happen without a bug: the layout has already refused. Use getPerson() in the " +
        "one place that genuinely branches on signed in or not.",
    );
  }
  return person;
}

/**
 * The current Person, or `null`, for the few places that genuinely branch on "signed
 * in or not". The sign-in page is the main one.
 */
export async function getPerson(): Promise<Person | null> {
  return currentPerson();
}
