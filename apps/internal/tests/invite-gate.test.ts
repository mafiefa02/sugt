import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addPerson,
  authSessions,
  authUsers,
  resetDatabase,
  revokePerson,
} from "./support/fixtures";
import { SIGN_IN_PATH, signInWithGoogle } from "./support/sign-in";

/**
 * **Seam 1 — the configured auth server's request handler.** This is the exact object
 * `app/api/auth/[...all]/route.ts` mounts; that file is a two-line adapter over it.
 *
 * Only external behaviour is asserted: the status and `Location` of a response,
 * whether a session cookie was issued, and the rows in `better_auth.user` and
 * `public.person` afterwards. No test asserts that a hook ran or that a helper exists
 * — a Better Auth upgrade replaces those without the product changing, and a test
 * that breaks on an upgrade which did not break the product is worse than no test.
 */
describe("the invite gate", () => {
  beforeEach(resetDatabase);
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lets an invited Teaching Team member in with any Google address", async () => {
    const person = await addPerson({
      fullName: "Prof. Ratna",
      email: "ratna@gmail.com",
      role: "Teaching Team",
    });

    const result = await signInWithGoogle({
      googleId: "google-ratna",
      email: "ratna@gmail.com",
      name: "Prof. Ratna",
    });

    expect(result.tokenExchanges).toBe(1);
    expect(result.sessionCookie).not.toBeNull();
    expect(result.location.pathname).toBe("/");

    const users = await authUsers();
    expect(users).toHaveLength(1);
    expect(users[0]!.personId).toBe(person.id);
  });

  it("lets invited Staff in with a DITSAMA address", async () => {
    await addPerson({
      fullName: "Rina Hartati",
      email: "rina@ditsama.itb.ac.id",
      role: "Staff",
    });

    const result = await signInWithGoogle({
      googleId: "google-rina",
      email: "rina@ditsama.itb.ac.id",
      name: "Rina Hartati",
    });

    expect(result.sessionCookie).not.toBeNull();
    expect(result.location.pathname).toBe("/");
  });

  it("refuses an uninvited address and leaves no user row", async () => {
    const result = await signInWithGoogle({
      googleId: "google-stranger",
      email: "stranger@gmail.com",
      name: "A Stranger",
    });

    expect(result.sessionCookie).toBeNull();
    expect(result.location.pathname).toBe(SIGN_IN_PATH);
    expect(result.location.searchParams.get("error")).not.toBeNull();
    await expect(authUsers()).resolves.toHaveLength(0);
  });

  it("refuses a Staff roster row that carries a non-DITSAMA address", async () => {
    /**
     * The fixture is the point. The Person's **own** email has to be the non-DITSAMA
     * one, or the hook finds no row at all and this is the uninvited case again with
     * the domain branch never running. So the only way to reach that branch is a
     * roster row that is itself wrong — which is what makes it a backstop against a
     * bad row rather than the working gate. The place the rule does day-to-day work is
     * validation on the People screen's add form.
     */
    await addPerson({
      fullName: "Wrongly Rostered",
      email: "wrongly.rostered@gmail.com",
      role: "Staff",
    });

    const result = await signInWithGoogle({
      googleId: "google-wrong",
      email: "wrongly.rostered@gmail.com",
      name: "Wrongly Rostered",
    });

    expect(result.sessionCookie).toBeNull();
    expect(result.location.pathname).toBe(SIGN_IN_PATH);
    await expect(authUsers()).resolves.toHaveLength(0);
  });

  it("refuses a revoked Person who has never signed in", async () => {
    await addPerson({
      fullName: "Sudah Keluar",
      email: "sudah.keluar@gmail.com",
      role: "Teaching Team",
      active: false,
    });

    const result = await signInWithGoogle({
      googleId: "google-keluar",
      email: "sudah.keluar@gmail.com",
      name: "Sudah Keluar",
    });

    expect(result.sessionCookie).toBeNull();
    expect(result.location.pathname).toBe(SIGN_IN_PATH);
    await expect(authUsers()).resolves.toHaveLength(0);
    await expect(authSessions()).resolves.toHaveLength(0);
  });

  it("matches the active Person, not the revoked one, when an email was re-added", async () => {
    /**
     * A wrong role is corrected by revoking the row and adding a new Person, so one
     * address legitimately appears twice. `person_email_key` is partial (`where
     * active`) for exactly this, and all three enforcement points look a Person up by
     * `lower(email) = $1 and active`.
     *
     * **The two rows are arranged so that only one of them can succeed.** The revoked
     * row is the wrong one — `Staff` against a personal Gmail — so matching it would
     * be refused by the domain backstop. The active row is `Teaching Team`, which any
     * Google address satisfies. Sign-in therefore succeeds only if the lookup skipped
     * the revoked row, and `person_id` names which row it landed on.
     */
    await addPerson({
      fullName: "Salah Peran",
      email: "salah.peran@gmail.com",
      role: "Staff",
      active: false,
    });
    const corrected = await addPerson({
      fullName: "Salah Peran",
      email: "Salah.Peran@gmail.com",
      role: "Teaching Team",
      active: true,
    });

    const result = await signInWithGoogle({
      googleId: "google-salah",
      email: "salah.peran@gmail.com",
      name: "Salah Peran",
    });

    expect(result.sessionCookie).not.toBeNull();
    expect(result.location.pathname).toBe("/");

    const users = await authUsers();
    expect(users).toHaveLength(1);
    expect(users[0]!.personId).toBe(corrected.id);
  });

  it("refuses a revoked Person who already has a user row, and mints no new session", async () => {
    const person = await addPerson({
      fullName: "Masih Punya Akun",
      email: "masih@gmail.com",
      role: "Teaching Team",
    });

    const first = await signInWithGoogle({
      googleId: "google-masih",
      email: "masih@gmail.com",
      name: "Masih Punya Akun",
    });
    expect(first.sessionCookie).not.toBeNull();
    await expect(authSessions()).resolves.toHaveLength(1);

    await revokePerson(person.id);

    const second = await signInWithGoogle({
      googleId: "google-masih",
      email: "masih@gmail.com",
      name: "Masih Punya Akun",
    });

    expect(second.sessionCookie).toBeNull();
    expect(second.location.pathname).toBe(SIGN_IN_PATH);
    // The user row survives — it is the sign-in identity, and nothing deletes it.
    await expect(authUsers()).resolves.toHaveLength(1);
    // The session row from before survives too, unused. Only the one that was refused is absent.
    await expect(authSessions()).resolves.toHaveLength(1);
  });

  it("sends an uninvited stranger and a revoked Person to the same place", async () => {
    await addPerson({
      fullName: "Dicabut",
      email: "dicabut@gmail.com",
      role: "Teaching Team",
      active: false,
    });

    const revoked = await signInWithGoogle({
      googleId: "google-dicabut",
      email: "dicabut@gmail.com",
      name: "Dicabut",
    });
    const uninvited = await signInWithGoogle({
      googleId: "google-asing",
      email: "asing@gmail.com",
      name: "Orang Asing",
    });

    /**
     * The assertion is the destination, not the parameter's value. `/masuk` renders
     * one message for every value of `?error` and never echoes it, so the two being
     * indistinguishable is true by construction rather than by two strings happening
     * to match.
     */
    expect(revoked.location.pathname).toBe(SIGN_IN_PATH);
    expect(uninvited.location.pathname).toBe(SIGN_IN_PATH);
  });
});
