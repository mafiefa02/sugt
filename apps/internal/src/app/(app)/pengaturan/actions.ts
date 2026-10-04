"use server";

import { randomBytes } from "node:crypto";

import { DRIVE_STATE_COOKIE } from "-/lib/drive/connect";
import { DRIVE_CALLBACK_PATH, driveAuthorizationUrl } from "-/lib/drive/google";
import { requirePerson } from "-/lib/person";
import { staffSurface } from "-/lib/staff-surface";
import { requireGrant } from "@sugt/db/queries";
import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * **Hubungkan Google Drive** / **Hubungkan ulang** (#372). Re-checks Administrator on the server —
 * the page's own check does not run before a Server Action — then sends the browser to Google's
 * consent screen with a fresh `state`.
 *
 * The `state` rides in an httpOnly, Secure, SameSite=Lax cookie scoped to the callback path, for ten
 * minutes. Lax is what lets it come back on Google's top-level redirect to the callback.
 */
export async function connectDriveAction(): Promise<never> {
  const person = await requirePerson();
  await staffSurface(async () => requireGrant(person, "Administrator"));

  const state = randomBytes(32).toString("base64url");
  (await cookies()).set(DRIVE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 10 * 60,
    path: DRIVE_CALLBACK_PATH,
  });
  // Google's consent screen is off-site, so typed routes has no entry for it.
  redirect(driveAuthorizationUrl(state) as Route);
}
