import type { Person } from "./caller";

/**
 * The Staff-only choke point. **Delivery data is open to everyone signed in;
 * financial data is not** — [ADR-0004](../../../../docs/adr/0004-delivery-data-is-open-internally-money-is-not.md).
 *
 * That rule is application code rather than RLS, because Better Auth means there is
 * no `auth.uid()` in Postgres and a policy would need `SET LOCAL` on every
 * transaction plus a non-superuser role with `FORCE ROW LEVEL SECURITY` — a great
 * deal of machinery for one two-role rule. So it lives here, at **one** place rather
 * than at each call site. See `docs/data-model.md`, *what the database does not
 * hold*.
 */

/** A `Person` the choke point has already checked. Money queries pass this on. */
export type StaffPerson = Person & { role: "Staff" };

const NOT_STAFF_ERROR_CODE = "sugt/not-staff";

/**
 * A non-Staff `Person` reached a money query.
 *
 * **Reaching this is a bug or an attack, never a user state.**
 * [#9](https://github.com/mafiefa02/sugt/issues/9) specifies the money-free Perjadin
 * variant as having the Advance strip, transactions and Report **absent rather than
 * disabled**, so the UI decides by role and never offers the surface to a Teaching
 * Team member.
 *
 * It throws rather than returning an empty result for exactly that reason: an empty
 * return would make a mis-passed caller indistinguishable from a Perjadin that
 * genuinely has no transactions yet, with nothing in the logs to separate them.
 */
export class NotStaffError extends Error {
  /**
   * **Discriminate on this, not on `instanceof`.**
   *
   * Two module instances of this package — a bundler splitting server and client
   * graphs is the ordinary way to get them — give two distinct classes, and
   * `instanceof` is false across them while the error is plainly the same error. A
   * string property survives that, and survives `structuredClone` and `JSON` too.
   */
  readonly sugtErrorCode = NOT_STAFF_ERROR_CODE;

  override readonly name = "NotStaffError";

  constructor(person: Person) {
    super(
      `A money query was handed ${person.role} caller ${person.id}. Money is Staff-only ` +
        `(ADR-0004), and the surfaces that read it are absent for Teaching Team rather ` +
        `than disabled — so this is a bug in whoever offered the surface, not a state a ` +
        `user can reach.`,
    );
  }
}

/**
 * Is this the Staff-only refusal?
 *
 * The app translates a `true` here into a **403**, not a crash page. Do that
 * **server-side**, at the call site: an `error.tsx` boundary is a client component
 * and receives a sanitized error in production, where every property but `digest` is
 * stripped — so a guard run there passes in development and silently fails in
 * production.
 */
export function isNotStaffError(error: unknown): error is NotStaffError {
  return (
    typeof error === "object" &&
    error !== null &&
    "sugtErrorCode" in error &&
    error.sugtErrorCode === NOT_STAFF_ERROR_CODE
  );
}

/**
 * The choke point itself. Every money-reading query opens with it, and it is the only
 * thing standing between Teaching Team and a receipt.
 *
 * It takes a `Person` rather than a `Caller` because the union's other two arms are
 * refused by the signature: `ServiceCaller` reads the three aggregate payloads and
 * `ParticipantToken` reads nothing at all, so neither can be handed to a money query
 * in the first place. Narrowing the union here instead would make the arm a runtime
 * shape check, which is what three named types exist to avoid.
 */
export function requireStaff(person: Person): StaffPerson {
  if (person.role !== "Staff") throw new NotStaffError(person);
  return person as StaffPerson;
}
