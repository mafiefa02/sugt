import { requireEnv } from "-/lib/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * **Legacy receipts in Supabase Storage — the read, and nothing else.**
 *
 * **Every upload goes to the company Google Drive since ADR-0040** (`lib/drive/`): Catat transaksi
 * since #373, a row's own Unggah bukti since #374, and nothing writes to the `receipts` bucket any
 * more. What is left here is the signed link for a receipt recorded before Drive, until those are
 * migrated and this file goes (#377, #379).
 *
 * **The private bucket is what makes this file different from `story-media.ts`.** A Story
 * photograph is published, so its URL is public and permanent. A legacy receipt sits in a private
 * bucket, and sign-in is Better Auth, so there is no `auth.uid()` and no storage RLS — see
 * `docs/adr/0011-supabase-and-better-auth.md`. Reading one therefore goes through
 * `signedReceiptUrl` below, minted on the acquittal page, an open money read (ADR-0026).
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
