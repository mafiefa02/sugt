"use server";

import { requirePerson } from "-/lib/person";
import {
  revalidatePublicStory,
  revalidationFailed,
  type RevalidationReport,
} from "-/lib/revalidate-public";
import { staffSurface } from "-/lib/staff-surface";
import {
  mintPhotoUpload,
  type PhotoUploadTarget,
  readPhotoFacts,
  removePhotoObject,
} from "-/lib/story-media";
import {
  addStoryPhotos,
  createStory,
  type CreateStoryInput,
  deleteStoryPhoto,
  type NewStoryPhoto,
  publishStory,
  setStoryCover,
  storyForEditor,
  storyPublicTargets,
  updateStory,
  type UpdateStoryInput,
  withdrawStory,
} from "@sugt/db/queries";

import {
  type FinalizeResult,
  MAX_PHOTO_BATCH,
  type PhotoToFinalize,
  type PublishActionResult,
} from "./action-types";

/**
 * **Cerita's Server Actions.** Each resolves the caller with `requirePerson()` and hands the work
 * to `@sugt/db`, wrapped in `staffSurface` so the query layer's Staff-only refusal reads as a 403
 * on the server rather than a crash on the client — the layout does not run before a Server Action,
 * so this wrapper is what actually closes the write path. Nothing here re-checks what the query
 * checks or opens a transaction the query should own.
 *
 * The photograph actions add a second concern the query layer cannot hold: Supabase Storage. The
 * bytes go browser-to-Storage through a signed URL, so these mint the URL, read the landed file
 * back, and only then record the row.
 */

/** The object-key prefix a Story's own photographs live under, per `data-model.md`. */
const storyKeyPrefix = (storyId: string) => `story/${storyId}/`;

/** Create a draft Story and return its id and generated slug, for the redirect into the editor. */
export async function createStoryAction(
  input: CreateStoryInput,
): Promise<{ id: string; slug: string }> {
  const person = await requirePerson();

  return staffSurface(() => createStory(person, input));
}

/** Save a Story's prose and badges. The explicit Save — the body is never persisted from a keystroke. */
export async function saveStoryAction(id: string, input: UpdateStoryInput): Promise<void> {
  const person = await requirePerson();

  await staffSurface(() => updateStory(person, id, input));
}

/**
 * Mint upload URLs for `count` photographs. Gated on Staff **and** on the Story existing, by a
 * staff-checked read before any URL is minted: an upload URL is a write credential for
 * `public-media`, so it is not handed out for a Story nobody can edit or that is not there.
 */
export async function mintPhotoUploadsAction(
  storyId: string,
  count: number,
): Promise<PhotoUploadTarget[]> {
  const person = await requirePerson();

  const story = await staffSurface(() => storyForEditor(person, storyId));
  if (!story) throw new Error(`No Story ${storyId} to attach photographs to.`);

  const wanted = Math.min(Math.max(0, Math.trunc(count)), MAX_PHOTO_BATCH);
  return Promise.all(Array.from({ length: wanted }, () => mintPhotoUpload(storyId)));
}

/**
 * Record the photographs whose bytes have landed. For each, the real content type and size are read
 * back from Storage — the server never saw the bytes — and one whose read-back fails is a PUT that
 * never landed: it is dropped and counted, not written with guessed columns. The rest are attached
 * in one insert. Partial success is a real state and is reported rather than swallowed.
 *
 * **A path is trusted only if it sits under this Story's own prefix.** The client echoes back the
 * keys minted for it, but a Server Action is a public endpoint, so a caller could send any key. Only
 * keys under `story/{storyId}/` are accepted — a forged one is rejected the same way a failed upload
 * is — so an arbitrary `public-media` object can never be attached to a Story.
 */
export async function finalizeStoryPhotosAction(
  storyId: string,
  landed: PhotoToFinalize[],
): Promise<FinalizeResult> {
  const person = await requirePerson();

  const prefix = storyKeyPrefix(storyId);
  const facts = await Promise.all(
    landed.map(async (item): Promise<NewStoryPhoto | null> => {
      if (!item.path.startsWith(prefix)) return null;
      const read = await readPhotoFacts(item.path);
      if (!read) return null;
      return {
        storagePath: item.path,
        contentType: read.contentType,
        byteSize: read.byteSize,
        caption: item.caption,
      };
    }),
  );
  const ready = facts.filter((photo): photo is NewStoryPhoto => photo !== null);

  if (ready.length > 0) await staffSurface(() => addStoryPhotos(person, storyId, ready));

  return { attached: ready.length, failed: landed.length - ready.length };
}

/** Promote a photograph to cover, or clear it (`photoId` null). Deleting the cover clears it elsewhere. */
export async function setStoryCoverAction(storyId: string, photoId: string | null): Promise<void> {
  const person = await requirePerson();

  await staffSurface(() => setStoryCover(person, storyId, photoId));
}

/**
 * Delete a photograph. The row is authoritative and goes first; the stored object is then removed
 * best-effort — an orphaned object in a public bucket is tidiness, a blocked delete is a bug. If it
 * was the cover, `story.cover_photo_id` clears itself (`on delete set null`); the delete is never
 * blocked.
 *
 * **The storage key comes from the Story's own row, never from the client.** `removePhotoObject`
 * uses the RLS-bypassing service role, so a client-supplied path would let a caller delete any
 * object in `public-media`. The path is read from this Story's photographs — which also confirms the
 * photograph is one of its own — and only that path is removed.
 */
export async function deleteStoryPhotoAction(storyId: string, photoId: string): Promise<void> {
  const person = await requirePerson();

  const story = await staffSurface(() => storyForEditor(person, storyId));
  const photo = story?.photos.find((candidate) => candidate.id === photoId);

  await staffSurface(() => deleteStoryPhoto(person, storyId, photoId));
  if (photo) await removePhotoObject(photo.storagePath);
}

/**
 * Publish a Story, then refresh its public pages. The database holds the one gate — photographs but
 * no cover is refused with `{ outcome: "needs-cover" }`, which the editor renders — so this returns
 * the outcome rather than throwing. Only a Story that actually published is revalidated.
 *
 * The slug the refresh needs — the Story's own and its School's — is **read from the row here**, not
 * taken as an argument, so a stale editor cannot revalidate the wrong page. A published Story that
 * somehow resolves no targets reports every step failed rather than nothing, so the operator is
 * never told a refresh happened when it did not.
 */
export async function publishStoryAction(id: string): Promise<PublishActionResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => publishStory(person, id));
  if (result.outcome !== "published") return { result, revalidation: null };

  const targets = await staffSurface(() => storyPublicTargets(person, id));
  const revalidation = targets
    ? await revalidatePublicStory({ slug: targets.slug, schoolSlug: targets.schoolSlug })
    : revalidationFailed();

  return { result, revalidation };
}

/**
 * Take a Story down, then refresh its public pages so the withdrawn Story stops being served.
 * Withdrawal has no gate — a draft withdrawn is a no-op — so this returns only the revalidation
 * report. The slugs are read from the row here, and a Story that resolves no targets reports every
 * step failed rather than an empty list the editor would render as blank silence.
 */
export async function withdrawStoryAction(id: string): Promise<RevalidationReport> {
  const person = await requirePerson();

  await staffSurface(() => withdrawStory(person, id));

  const targets = await staffSurface(() => storyPublicTargets(person, id));
  return targets
    ? revalidatePublicStory({ slug: targets.slug, schoolSlug: targets.schoolSlug })
    : revalidationFailed();
}
