import { isNotStaffError } from "@sugt/db/queries";
import { forbidden } from "next/navigation";

/**
 * Turn `@sugt/db`'s Staff-only refusal into a **403**.
 *
 * `@sugt/db` throws `NotStaffError` and stops there, because it is not Next-aware and
 * should not become so — it has no Next plugin in its tsconfig and both apps' worth
 * of routing conventions are the app's business. So the translation lives here, on
 * the app's side of that line.
 *
 * **It has to run on the server, and that is the whole reason this file exists.** The
 * obvious place to put it is an `error.tsx` boundary, and that place is wrong: an
 * `error.tsx` is a client component and receives a *sanitized* error in production,
 * where every property but `digest` is stripped. `isNotStaffError` would pass in
 * development and silently fail once deployed — the worst shape of bug available
 * here, because the failing case is the one nobody exercises locally.
 *
 * Wrap the read instead:
 *
 * ```ts
 * const acquittal = await staffSurface(() => perjadinAcquittal(person, id));
 * ```
 *
 * Reaching it is still a bug or an attack rather than a user state — the surfaces
 * that read money are **absent** for a Teaching Team member, not disabled — so this
 * renders a refusal and does not try to be helpful about it.
 */
export async function staffSurface<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (isNotStaffError(error)) forbidden();
    throw error;
  }
}
