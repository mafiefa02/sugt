import { resolvePerson } from "-/lib/person";
import { staffSurface } from "-/lib/staff-surface";
import { isNotStaffError, perjadinAcquittal } from "@sugt/db/queries";
import type { Role } from "@sugt/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addPerjadin, addPerson, addTransaction, resetDatabase } from "./support/fixtures";
import { signInWithGoogle } from "./support/sign-in";

/**
 * **The Staff-only choke point**, driven at the seam
 * [#24](https://github.com/mafiefa02/sugt/issues/24) established.
 *
 * The `Person` handed to the money query is a real one, and that is the point of
 * running this here rather than as a unit test on the guard: sign in through seam 1,
 * take the `Set-Cookie`, resolve it through seam 2, hand the result to the query.
 * Nothing asserts that a particular helper ran — that is the kind of test a Better
 * Auth upgrade breaks without breaking the product.
 *
 * ADR-0004: delivery data is open to everyone signed in; **financial data is not**.
 */
describe("money is Staff-only", () => {
  beforeEach(resetDatabase);
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /** Sign in for real, and resolve the cookie the way a request does. */
  async function signIn(role: Role, email: string, fullName: string) {
    await addPerson({ fullName, email, role });
    const result = await signInWithGoogle({ googleId: `google-${email}`, email, name: fullName });
    if (!result.sessionCookie) throw new Error("Expected the sign-in to issue a session cookie");

    const person = await resolvePerson(new Headers({ cookie: result.sessionCookie }));
    if (!person) throw new Error("Expected the cookie to resolve to a Person");
    return person;
  }

  /** A trip with an Advance and one line item against it. */
  async function aPerjadinWithSpending() {
    const pic = await signIn("Staff", "rina@ditsama.itb.ac.id", "Rina Nurhayati");
    const perjadin = await addPerjadin({ advanceIdr: 5_000_000, picPersonId: pic.id });
    await addTransaction({
      perjadinId: perjadin.id,
      amountIdr: 1_250_000,
      createdByPersonId: pic.id,
    });
    return { pic, perjadin };
  }

  it("refuses a Teaching Team Person with a distinguishable typed error", async () => {
    const { perjadin } = await aPerjadinWithSpending();
    const teacher = await signIn("Teaching Team", "budi@gmail.com", "Budi Santoso");

    const refusal = await perjadinAcquittal(teacher, perjadin.id).catch((error: unknown) => error);

    expect(isNotStaffError(refusal)).toBe(true);
  });

  it("refuses rather than returning an empty result", async () => {
    /**
     * An empty return would make a mis-passed caller indistinguishable from a trip
     * that genuinely has no transactions yet, with nothing in the logs to separate
     * them. So the refusal is a throw, and this asserts it is not quietly a `null`.
     */
    const { perjadin } = await aPerjadinWithSpending();
    const teacher = await signIn("Teaching Team", "ratna@gmail.com", "Ratna Dewi");

    await expect(perjadinAcquittal(teacher, perjadin.id)).rejects.toThrow();
  });

  it("gives Staff the reconciliation, derived rather than stored", async () => {
    const { pic, perjadin } = await aPerjadinWithSpending();

    await expect(perjadinAcquittal(pic, perjadin.id)).resolves.toMatchObject({
      perjadinId: perjadin.id,
      advanceIdr: 5_000_000,
      spentIdr: 1_250_000,
      remainderIdr: 3_750_000,
      returnedToTreasurerIdr: null,
    });
  });

  it("reads a trip that has spent nothing as zero, not as unknown", async () => {
    const pic = await signIn("Staff", "rina@ditsama.itb.ac.id", "Rina Nurhayati");
    const perjadin = await addPerjadin({ advanceIdr: 2_000_000, picPersonId: pic.id });

    await expect(perjadinAcquittal(pic, perjadin.id)).resolves.toMatchObject({
      spentIdr: 0,
      remainderIdr: 2_000_000,
    });
  });

  it("reaches the browser as a 403, not as a crash page", async () => {
    /**
     * The product half of the refusal: what a Teaching Team member who somehow
     * reached a money surface actually gets back.
     *
     * `forbidden()` throws an error carrying `NEXT_HTTP_ERROR_FALLBACK;403` as its
     * digest, and that digest is what Next reads to pick the status and render
     * `forbidden.tsx`. It is the closest observable to "the status of the response"
     * reachable without standing up a Next server, and it is the property that
     * actually matters — the alternative is the default error boundary and a 500.
     *
     * The environment variable is what `experimental.authInterrupts` in
     * `next.config.ts` sets during a build. Setting it here asserts the behaviour
     * under the deployed condition; asserting the config file itself would be
     * testing it against itself.
     */
    vi.stubEnv("__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS", "1");
    const { perjadin } = await aPerjadinWithSpending();
    const teacher = await signIn("Teaching Team", "budi@gmail.com", "Budi Santoso");

    const thrown = await staffSurface(() => perjadinAcquittal(teacher, perjadin.id)).catch(
      (error: unknown) => error,
    );

    expect((thrown as { digest?: string }).digest).toBe("NEXT_HTTP_ERROR_FALLBACK;403");
  });

  it("tells a missing Perjadin apart from a refusal", async () => {
    /**
     * Both are absences and only one is a bug. A stale link to a deleted trip is a
     * state a Staff member genuinely reaches, so it is a `null` rather than a throw.
     */
    const pic = await signIn("Staff", "rina@ditsama.itb.ac.id", "Rina Nurhayati");

    await expect(
      perjadinAcquittal(pic, "00000000-0000-0000-0000-000000000000"),
    ).resolves.toBeNull();
  });
});
