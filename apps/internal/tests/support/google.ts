import { vi } from "vitest";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export type GoogleProfile = {
  /** Google's stable subject id. Two sign-ins by one account share it. */
  googleId: string;
  email: string;
  name: string;
};

/**
 * Google's token endpoint, stubbed at the network boundary.
 *
 * **This is the only thing the tests fake**, and it is the only thing they genuinely
 * cannot reach: everything else — the handler, the hooks, the schema — is the real
 * object. Anything else that tries to leave the process throws, so a call this stub
 * does not know about is loud rather than silent.
 *
 * The id token is **decoded, not verified**, on the authorization-code path:
 * `google.getUserInfo` calls jose's `decodeJwt`, and `verifyIdToken` is only reached
 * by the separate id-token sign-in endpoint, which is not mounted here. That is why
 * an unsigned token is enough. If a Better Auth upgrade starts verifying, this stub
 * has to mint a signed token and serve a JWKS — the failure will look like
 * `?error=unable_to_get_user_info`.
 */
export function stubGoogle(profile: GoogleProfile) {
  const stub = {
    /** How many times the token endpoint was exchanged. Assert this, or a stub that never ran passes. */
    tokenExchanges: 0,
  };

  vi.stubGlobal("fetch", async (input: RequestInfo | URL): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith(TOKEN_ENDPOINT)) {
      stub.tokenExchanges += 1;
      return Response.json({
        access_token: "stub-access-token",
        token_type: "Bearer",
        expires_in: 3599,
        scope: "openid https://www.googleapis.com/auth/userinfo.email",
        id_token: mintIdToken(profile),
      });
    }
    throw new Error(`The tests stub Google only. Unexpected outbound request: ${url}`);
  });

  return stub;
}

function mintIdToken(profile: GoogleProfile): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = segment({ alg: "RS256", kid: "stub", typ: "JWT" });
  const payload = segment({
    iss: "https://accounts.google.com",
    aud: process.env.GOOGLE_CLIENT_ID,
    sub: profile.googleId,
    email: profile.email,
    email_verified: true,
    name: profile.name,
    picture: "https://example.invalid/avatar.png",
    iat: issuedAt,
    exp: issuedAt + 3600,
  });
  return `${header}.${payload}.c3R1Yi1zaWduYXR1cmU`;
}

function segment(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
