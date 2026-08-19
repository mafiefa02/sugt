import { timingSafeEqual } from "node:crypto";

import { requireEnv } from "-/lib/env";

/**
 * **The revalidation route's contract, factored out of the handler so it can be reasoned about and
 * tested on its own.** The internal app calls the route when a Story is published or withdrawn; this
 * decides whether the caller may, and names the pages to refresh and the order to refresh them in.
 */

/** The pages a publish or withdrawal invalidates, and the order they must run. */
export type RevalidationTarget = "detail" | "list" | "final-project-list" | "school";

/**
 * What the route revalidates, given a Story slug and its School's slug. **Detail first, then the two
 * lists, then the School page** — a list must never be rebuilt pointing at a detail page the refresh
 * has not reached, and the School page carries the Story too.
 *
 * **Both lists are refreshed, because the request does not carry the Story's kind.** A field Story
 * shows on `/cerita` and a Final Project piece on `/final-project` (#38 made Final Project its own
 * section), so the route cannot tell which list gained or lost this Story from `{slug, school}` alone.
 * Refreshing the list the Story is *not* on is a harmless re-render of unchanged content; missing the
 * one it *is* on would leave a published piece invisible until the revalidate window. So it does both.
 *
 * Revalidating a path that does not exist yet is harmless.
 */
export function revalidationTargets(
  slug: string,
  school: string,
): { target: RevalidationTarget; path: string }[] {
  return [
    { target: "detail", path: `/cerita/${slug}` },
    { target: "list", path: "/cerita" },
    { target: "final-project-list", path: "/final-project" },
    { target: "school", path: `/sekolah/${school}` },
  ];
}

/**
 * Whether the request carries the right `REVALIDATE_SECRET`. `false` is the route's 401, and a 401
 * **revalidates nothing** — the check runs before any `revalidatePath`.
 *
 * Constant-time, length-checked first because `timingSafeEqual` throws on unequal-length buffers, so
 * a wrong-length token would otherwise be a 500 rather than a 401. This is the only write-shaped
 * thing the public app has, and it writes nothing but its own cache.
 */
export function authorizeRevalidate(request: Request): boolean {
  const header = request.headers.get("authorization");
  const prefix = "Bearer ";
  if (!header?.startsWith(prefix)) return false;

  const presented = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(requireEnv("REVALIDATE_SECRET"));
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(presented, expected);
}
