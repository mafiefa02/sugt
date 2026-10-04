import {
  completeDriveConnection,
  DRIVE_STATE_COOKIE,
  driveConnectMessage,
} from "-/lib/drive/connect";
import { DRIVE_CALLBACK_PATH } from "-/lib/drive/google";
import { requireEnv } from "-/lib/env";
import { resolvePerson } from "-/lib/person";
import { NextResponse, type NextRequest } from "next/server";

/**
 * **Where Google sends an Administrator back** after Hubungkan Google Drive (#372). The seven checks
 * and the storing are `completeDriveConnection`; this only carries the request in and the answer out.
 *
 * Every answer clears the `state` cookie — it is single-use. A caller who is not an Administrator
 * (check 3) gets a **403** here rather than a trip to `/pengaturan`, which would refuse them anyway;
 * every other outcome returns to `/pengaturan?drive=<outcome>`, which turns it into its sentence.
 */
export async function GET(request: NextRequest) {
  const outcome = await completeDriveConnection({
    params: request.nextUrl.searchParams,
    stateCookie: request.cookies.get(DRIVE_STATE_COOKIE)?.value,
    person: await resolvePerson(request.headers),
  });

  const response =
    outcome === "not-administrator"
      ? new NextResponse(driveConnectMessage(outcome, requireEnv("GOOGLE_DRIVE_ACCOUNT_EMAIL")), {
          status: 403,
          headers: { "content-type": "text/plain; charset=utf-8" },
        })
      : NextResponse.redirect(new URL(`/pengaturan?drive=${outcome}`, request.url));
  response.cookies.delete({ name: DRIVE_STATE_COOKIE, path: DRIVE_CALLBACK_PATH });
  return response;
}
