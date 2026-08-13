import type { RevalidationReport } from "-/lib/revalidate-public";
import type { PublishResult, StoryPhoto } from "@sugt/db/queries";

/**
 * The shapes the Cerita Server Actions pass to and from the client. They live here rather than in
 * `actions.ts` because that file is `"use server"`: every one of its exports is a callable Server
 * Action, and a type is not one. Keeping the types beside it, in a plain module, lets both the
 * actions and the editor import them.
 */

/** One photograph the browser has PUT to Storage, waiting to be recorded as a `story_photo` row. */
export type PhotoToFinalize = {
  /** The object key returned when its upload URL was minted. */
  path: string;
  caption: string | null;
};

/**
 * What `finalizeStoryPhotosAction` recorded. `failed` is the count whose bytes never landed — a
 * real partial-success state, since the browser uploads several files independently and one PUT can
 * fail while the rest succeed. The successes are still attached; the failures are reported, not
 * discarded silently.
 */
export type FinalizeResult = { attached: number; failed: number };

/**
 * The result of a publish attempt: the database `outcome` (including the one gate, `needs-cover`),
 * and the revalidation report — `null` when nothing published, so no page needed refreshing.
 */
export type PublishActionResult = {
  result: PublishResult;
  revalidation: RevalidationReport | null;
};

/**
 * A gallery photograph as the editor renders it: the `story_photo` row plus the public URL the
 * server builds from its `storage_path`. The URL is assembled server-side so `SUPABASE_URL` stays
 * off the client — the internal editor shows a thumbnail, it does not need a Supabase client.
 */
export type EditorPhoto = StoryPhoto & { url: string };
