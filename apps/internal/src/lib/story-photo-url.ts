import { requireEnv } from "-/lib/env";

/**
 * The public URL for a Story photograph in the `public-media` bucket.
 *
 * **Split out from `story-media.ts` on purpose.** That module constructs the RLS-bypassing
 * service-role Supabase client; this is the one piece the server pages need, and it is a pure string
 * builder with no `@supabase/supabase-js` import. Keeping them apart is structural rather than a rule
 * a reviewer has to remember: building a thumbnail URL cannot pull the service-role client toward a
 * bundle, because it is not in this file to pull.
 *
 * `public-media` is a public bucket, so the URL carries no token and any browser can load it.
 * `SUPABASE_URL` still stays on the server: `requireEnv` reads `process.env`, and the pages that call
 * this are Server Components.
 */
export function publicUrlFor(storagePath: string): string {
  return `${requireEnv("SUPABASE_URL")}/storage/v1/object/public/public-media/${storagePath}`;
}
