import { proxy } from "-/proxy";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addPerson, resetDatabase } from "./support/fixtures";
import { SIGN_IN_PATH, signInWithGoogle } from "./support/sign-in";

/**
 * **The one thing about `proxy.ts` worth asserting: that it recognises the cookie our
 * own handler issues.**
 *
 * This is not the matcher test the spec excludes — that exclusion is about asserting
 * patterns against routes which do not exist yet. This asserts a round trip between
 * two halves of this feature, and the failure it catches is a **redirect loop**, not a
 * missed redirect: `proxy` would send a signed-in visitor from `/` to `/masuk`,
 * `/masuk` would resolve their Person and `redirect("/")`, and `/` matches again.
 *
 * It cannot be seen from either named seam. Seam 1 stops at `Set-Cookie` and seam 2
 * takes a `Headers` rather than a request. So the cookie is taken from seam 1 and
 * handed to the proxy, the same way seam 2 is fed.
 */
describe("the optimistic check", () => {
  beforeEach(resetDatabase);
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function request(cookie?: string) {
    return new NextRequest("http://localhost:3001/", {
      headers: cookie ? { cookie } : {},
    });
  }

  it("sends a visitor with no session cookie to the sign-in screen", () => {
    const response = proxy(request());

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe(SIGN_IN_PATH);
  });

  it("lets through the cookie the auth handler actually issues", async () => {
    // The role is incidental here — the round trip asserts the proxy recognises the cookie our
    // handler issues, not anything about the Person's role. T3 (#153) retired the Teaching Team
    // Role, so any signed-in Person is Staff now.
    await addPerson({
      fullName: "Ratna",
      email: "ratna@gmail.com",
      role: "Staff",
    });
    const { sessionCookie } = await signInWithGoogle({
      googleId: "google-ratna",
      email: "ratna@gmail.com",
      name: "Prof. Ratna",
    });

    const response = proxy(request(sessionCookie!));

    // Not a redirect. If this ever fails, `/` and `/masuk` bounce off each other.
    expect(response.headers.get("location")).toBeNull();
  });
});
