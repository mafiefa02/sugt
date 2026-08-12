import { auth } from "-/lib/auth";

import { stubGoogle, type GoogleProfile } from "./google";

const ORIGIN = "http://localhost:3001";

/** Where a rejected visitor is sent, and where the sign-in screen lives. */
export const SIGN_IN_PATH = "/masuk";

export type SignInResult = {
  /** The callback's own response. Nothing follows the redirect. */
  response: Response;
  /** Where the browser is sent next, as a URL. */
  location: URL;
  /** The session cookie, ready to hand to seam 2. `null` when none was issued. */
  sessionCookie: string | null;
  /** How many times Google's token endpoint was reached. */
  tokenExchanges: number;
};

/**
 * Drive a whole Google sign-in through the same handler `route.ts` mounts.
 *
 * Two requests, because that is what a browser makes: `POST /sign-in/social` to get
 * the authorization URL and the state cookie, then `GET /callback/google` carrying
 * the code Google would have sent back. Nothing here is a Next.js server and nothing
 * is a browser driver — the assertions are on a real `Response`.
 */
export async function signInWithGoogle(profile: GoogleProfile): Promise<SignInResult> {
  const google = stubGoogle(profile);

  const start = await auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({
        provider: "google",
        callbackURL: "/",
        errorCallbackURL: SIGN_IN_PATH,
      }),
    }),
  );
  if (!start.ok) {
    throw new Error(`sign-in/social failed: ${start.status} ${await start.text()}`);
  }

  const { url } = (await start.json()) as { url: string };
  const state = new URL(url).searchParams.get("state");
  if (!state) throw new Error(`No state on the authorization URL: ${url}`);

  const response = await auth.handler(
    new Request(
      `${ORIGIN}/api/auth/callback/google?state=${encodeURIComponent(state)}&code=stub-authorization-code`,
      { headers: { cookie: cookieHeader(start), origin: ORIGIN } },
    ),
  );

  return {
    response,
    location: new URL(response.headers.get("location") ?? "", ORIGIN),
    sessionCookie: sessionCookie(response),
    tokenExchanges: google.tokenExchanges,
  };
}

/** Every `Set-Cookie` on a response, folded into the `Cookie` header a browser would send back. */
export function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";", 1)[0])
    .join("; ");
}

/**
 * The session cookie alone, as a `Cookie` header. Seam 2 is fed by seam 1: sign in
 * through the handler, take what it issued, hand it to the resolver — so the
 * resolver's inputs are always real ones.
 */
export function sessionCookie(response: Response): string | null {
  const issued = response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";", 1)[0])
    .filter((cookie) => cookie.includes("session_token") && !cookie.endsWith("="));
  return issued.length > 0 ? issued.join("; ") : null;
}
