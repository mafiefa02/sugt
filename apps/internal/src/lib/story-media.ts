import { randomUUID } from "node:crypto";

import { requireEnv } from "-/lib/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * **Story photographs in Supabase Storage — the server half of the upload.**
 *
 * The bytes never pass through this app. The browser uploads them straight to Storage through a
 * signed upload URL this module mints with the service-role key, so a phone photograph is not
 * bound by Vercel's 4.5 MB function limit. Sign-in is Better Auth, so there is no `auth.uid()` and
 * no storage RLS: the service role is the only credential, and it stays on the server
 * ([ADR-0011](../../../../docs/adr/0011-supabase-and-better-auth.md), and
 * `docs/research/supabase-storage-without-supabase-auth.md`).
 *
 * `story_photo` mirrors `transaction_evidence`, so this is the one upload pattern the whole app
 * shares — receipts will mint the same way against the private `receipts` bucket when they are
 * built.
 */

const BUCKET = "public-media";

/**
 * One service-role client for the process. It carries the key that bypasses RLS, so it must never
 * be constructed anywhere a browser bundle can reach — this module is imported only by Server
 * Actions. Auth session persistence is off: there is no user session here, only the service role.
 */
let client: SupabaseClient | null = null;
function storage() {
  client ??= createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client.storage.from(BUCKET);
}

/**
 * The object key for one photograph: `story/{story_id}/{uuid}`, per the convention in
 * `data-model.md`. `storyId` is guarded non-empty: an empty segment would collapse `story//{uuid}`
 * into a shorter, still-valid, wrong key inside the client's key normaliser — a silent write to the
 * wrong place rather than an error.
 */
function keyFor(storyId: string): string {
  if (!storyId) throw new Error("Cannot mint a Story photo key without a Story id.");
  return `story/${storyId}/${randomUUID()}`;
}

/** A minted upload target. `signedUrl` is absolute and carries its own token — the browser PUTs the file bytes straight to it, no credential of its own. */
export type PhotoUploadTarget = {
  /** The object key, kept so the finalize step can read the file back and store it in the row. */
  path: string;
  /** The absolute URL the browser PUTs to. Valid for two hours (the server's fixed window). */
  signedUrl: string;
};

/** Mint one signed upload URL. `upsert` stays false, so a leaked token can write the object once and no more. */
export async function mintPhotoUpload(storyId: string): Promise<PhotoUploadTarget> {
  const path = keyFor(storyId);
  const { data, error } = await storage().createSignedUploadUrl(path);
  if (error) throw error;
  return { path, signedUrl: data.signedUrl };
}

/** What Storage recorded about a file it accepted — read back rather than trusted from the browser. */
export type PhotoObjectFacts = { contentType: string; byteSize: number };

/**
 * Read a landed file's real content type and size from Storage. Under the signed-URL pattern the
 * server never sees the bytes, so this read-back is the only defensible source for the two columns
 * `story_photo` stores — not what the browser claimed. Returns `null` if the object is not there,
 * which is how a PUT that never landed is told apart from one that did.
 */
export async function readPhotoFacts(path: string): Promise<PhotoObjectFacts | null> {
  const { data, error } = await storage().info(path);
  if (error) return null;
  if (typeof data.size !== "number" || typeof data.contentType !== "string") return null;
  return { contentType: data.contentType, byteSize: data.size };
}

/**
 * Best-effort removal of the stored object after its row is gone. The row is the source of truth
 * for whether a photograph exists, so this runs **after** `deleteStoryPhoto` and a failure here is
 * swallowed — an orphaned object in a public bucket is a tidiness problem, a blocked delete is a
 * product one. Returns whether the object was removed, for logging, not for control flow.
 */
export async function removePhotoObject(path: string): Promise<boolean> {
  const { error } = await storage().remove([path]);
  return !error;
}
