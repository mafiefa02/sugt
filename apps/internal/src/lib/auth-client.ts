import { createAuthClient } from "better-auth/react";

/**
 * The browser half. Only two things call it: the Google button on `/masuk` and the
 * sign-out control in the signed-in layout.
 *
 * No `baseURL`. The client defaults to the origin it is served from, which is what
 * both apps want and one fewer `NEXT_PUBLIC_*` variable to keep in step with
 * `BETTER_AUTH_URL`.
 */
export const authClient = createAuthClient();
