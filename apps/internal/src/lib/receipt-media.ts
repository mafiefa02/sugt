import { randomUUID } from "node:crypto";

import { requireEnv } from "-/lib/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * **Receipts in Supabase Storage — the server half of the upload, and the whole of the read.**
 *
 * The same pattern as `story-media.ts`, against the **private** `receipts` bucket instead of
 * the public one. The bytes never pass through this app: the browser PUTs a photographed
 * receipt straight to Storage through a signed upload URL minted here with the service-role
 * key, so a phone photograph is not bound by Vercel's 4.5 MB function limit.
 *
 * **The private bucket is what makes this file different from its sibling.** A Story
 * photograph is published, so its URL is public and permanent. A receipt is Staff-only
 * (ADR-0004), and sign-in is Better Auth, so there is no `auth.uid()` and no storage RLS to
 * express that — see `docs/adr/0011-supabase-and-better-auth.md`. Reading a receipt therefore
 * goes through `signedReceiptUrl` below, and the check that the caller is Staff happens
 * before it at one choke point in the query layer, exactly as `data-model.md` requires.
 */

const BUCKET = "receipts";

/** How long a minted read link lives. Long enough to render a screen, short enough that a copied URL goes stale. */
const READ_URL_LIFETIME_SECONDS = 60 * 10;

/**
 * One service-role client for the process. It carries the key that bypasses RLS, so it must
 * never be constructed anywhere a browser bundle can reach — this module is imported only by
 * Server Actions and a Route Handler. Auth session persistence is off: there is no user
 * session here, only the service role.
 */
let client: SupabaseClient | null = null;
function storage() {
  client ??= createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client.storage.from(BUCKET);
}

/**
 * **The object key is opaque, and that is the decision this module turns on.**
 *
 * A signed URL carries its object path inside the JWT it is signed with, so anything the key
 * spells out travels with every link the acquittal screen renders. A structured key —
 * `perjadin/{perjadin_id}/{transaction_id}/{uuid}` — would put the trip's identifiers into a
 * string that outlives the page. A bare UUID names nothing: not the Perjadin, not the line
 * item, not who uploaded it.
 *
 * **What that costs, and why it costs nothing here.** `story-media.ts`'s sibling check is a
 * key prefix: a Story photograph is trusted only under `story/{storyId}/`, which stops one
 * Story's photograph being attached to another, and stops any other object in the shared
 * `public-media` bucket being attached at all. An opaque key has no prefix to check. It gives
 * up nothing, because the two things that check defends are already closed here:
 *
 * - `receipts` holds receipts and nothing else, and every one of them is readable by every
 *   Staff member already, so there is no object in this bucket a Staff caller could reach by
 *   forging a key that they could not reach by asking for it honestly.
 * - `transaction_evidence.storage_path` is `unique`, so an object already attached cannot be
 *   attached a second time.
 *
 * What remains is a Staff member attaching their own freshly minted key to a line item other
 * than the one they minted it against — which they could equally do by minting against that
 * line item in the first place. The line item is still checked against its Perjadin in
 * `attachTransactionEvidence`, so the Perjadin boundary holds regardless of the key.
 */
function opaqueKey(): string {
  return randomUUID();
}

/** A minted upload target. `signedUrl` is absolute and carries its own token — the browser PUTs the file bytes straight to it, no credential of its own. */
export type ReceiptUploadTarget = {
  /** The opaque object key, kept so the finalize step can read the file back and store it in the row. */
  path: string;
  /** The absolute URL the browser PUTs to. Valid for two hours (the server's fixed window). */
  signedUrl: string;
};

/** Mint one signed upload URL. `upsert` stays false, so a leaked token can write the object once and no more. */
export async function mintReceiptUpload(): Promise<ReceiptUploadTarget> {
  const path = opaqueKey();
  const { data, error } = await storage().createSignedUploadUrl(path);
  if (error) throw error;
  return { path, signedUrl: data.signedUrl };
}

/** What Storage recorded about a file it accepted — read back rather than trusted from the browser. */
export type ReceiptObjectFacts = { contentType: string; byteSize: number };

/**
 * Read a landed receipt's real content type and size from Storage. Under the signed-URL
 * pattern the server never sees the bytes, so this read-back is the only defensible source
 * for the two columns `transaction_evidence` stores — not what the browser claimed. Returns
 * `null` if the object is not there, which is how a PUT that never landed is told apart from
 * one that did.
 */
export async function readReceiptFacts(path: string): Promise<ReceiptObjectFacts | null> {
  const { data, error } = await storage().info(path);
  if (error) return null;
  if (typeof data.size !== "number" || typeof data.contentType !== "string") return null;
  return { contentType: data.contentType, byteSize: data.size };
}

/**
 * A short-lived link that renders one receipt.
 *
 * `story-photo-url.ts` builds a public URL by string concatenation because `public-media` is
 * public. This bucket is not, so there is nothing to concatenate: the URL has to be signed,
 * and signing is a network call. Returns `null` when the object is gone, so a receipt whose
 * bytes were removed underneath its row renders as a missing file rather than a broken page.
 *
 * **This function performs no authorisation of its own.** Every caller reaches it through a
 * payload that `requireStaff` already produced; putting a second check here would be a second
 * place to get the rule right, which is the arrangement `data-model.md` rules out.
 */
export async function signedReceiptUrl(path: string): Promise<string | null> {
  const { data, error } = await storage().createSignedUrl(path, READ_URL_LIFETIME_SECONDS);
  if (error) return null;
  return data.signedUrl;
}
