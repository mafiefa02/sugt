import { auth } from "-/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * The Better Auth handler, mounted where the library's own convention puts it.
 *
 * Deliberately un-clever: this path is what every Better Auth upgrade guide assumes,
 * and this file is a two-line adapter over `auth.handler` so that the tests can drive
 * the same object without a Next.js server. Sign-out comes free with it.
 *
 * `toNextJsHandler` exports more verbs than the docs show; these are the two the
 * mounted routes use.
 */
export const { GET, POST } = toNextJsHandler(auth);
