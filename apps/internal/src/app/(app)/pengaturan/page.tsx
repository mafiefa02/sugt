import { driveConnectMessage, parseDriveConnectOutcome } from "-/lib/drive/connect";
import { readyFolders } from "-/lib/drive/fixed-folders";
import { requireEnv } from "-/lib/env";
import { requirePerson } from "-/lib/person";
import { driveConnectionCard, hasGrant, type DriveConnectionCard } from "@sugt/db/queries";
import { Alert, AlertDescription } from "@sugt/ui/components/alert";
import { Button } from "@sugt/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@sugt/ui/components/card";
import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { connectDriveAction } from "./actions";

export const metadata: Metadata = { title: "Pengaturan" };

/**
 * **Pengaturan** (#372) — Administrator only. Today it holds one card: the company Google Drive that
 * transaction evidence is stored in (ADR-0040).
 *
 * Anyone else, a Pimpinan included, gets `forbidden()` and the 403. That is the page's gate; the
 * connect action and the callback each re-check Administrator themselves, because a layout or page
 * does not run before a Server Action or a Route Handler. The sidebar hides the link from the same
 * people, so the 403 is only ever reached by a direct URL.
 */
export default async function Page({ searchParams }: PageProps<"/pengaturan">) {
  const person = await requirePerson();
  if (!hasGrant(person, "Administrator")) forbidden();

  const connection = await driveConnectionCard(person);
  const accountEmail = requireEnv("GOOGLE_DRIVE_ACCOUNT_EMAIL");
  const outcome = parseDriveConnectOutcome((await searchParams).drive);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border px-7 py-5">
        <h1 className="font-heading text-lg font-medium">Pengaturan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hanya Administrator yang dapat membuka halaman ini.
        </p>
      </header>

      <div className="flex max-w-2xl flex-col gap-4 px-7 py-6">
        {outcome && (
          <Alert variant={outcome === "connected" ? "default" : "destructive"}>
            <AlertDescription>{driveConnectMessage(outcome, accountEmail)}</AlertDescription>
          </Alert>
        )}
        <DriveCard
          connection={connection}
          accountEmail={accountEmail}
        />
      </div>
    </div>
  );
}

/** `2026-10-05 09:30 WIB` — the ISO form every date in the internal app reads in. */
function formatWhen(when: Date): string {
  const formatted = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    dateStyle: "short",
    timeStyle: "short",
  }).format(when);
  return `${formatted} WIB`;
}

/**
 * The Google Drive card, in one of four states:
 * - **Belum terhubung** — no row.
 * - **Terputus sejak …** — the stored token stopped working; uploads wait for a reconnect.
 * - **Folder bermasalah** — the token works, but the root or `_staging` is trashed or gone, or the
 *   last connect did not finish the tree, so the card does not claim Terhubung until a reconnect
 *   settles it (`readyFolders`, the same predicate uploads read).
 * - **Terhubung** — the account, its root folder, who connected it and when, and when it was last used.
 *
 * There is no disconnect button, by design: nothing would be gained by a state with no token.
 */
function DriveCard({
  connection,
  accountEmail,
}: {
  connection: DriveConnectionCard | null;
  accountEmail: string;
}) {
  const connectButton = (label: string) => (
    <form action={connectDriveAction}>
      <Button type="submit">{label}</Button>
    </form>
  );

  if (!connection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Google Drive</CardTitle>
          <CardDescription>Belum terhubung</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Bukti transaksi disimpan di Google Drive perusahaan ({accountEmail}). Hubungkan akun itu
          agar Catat transaksi dan Unggah bukti dapat mengunggah.
        </CardContent>
        <CardFooter>{connectButton("Hubungkan Google Drive")}</CardFooter>
      </Card>
    );
  }

  if (connection.status === "broken") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Google Drive</CardTitle>
          <CardDescription className="text-destructive">
            {/* `drive_connection_broken_at_check` guarantees a broken row has `broken_at`. */}
            Terputus sejak {formatWhen(connection.brokenAt!)}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Bukti transaksi tidak dapat diunggah sampai Google Drive dihubungkan ulang dengan akun{" "}
          {connection.accountEmail}.
        </CardContent>
        <CardFooter>{connectButton("Hubungkan ulang")}</CardFooter>
      </Card>
    );
  }

  const folders = readyFolders(connection);
  if (!folders) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Google Drive</CardTitle>
          <CardDescription className="text-destructive">Folder bermasalah</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {driveConnectMessage(connection.folderProblem ?? "folders-unfinished", accountEmail)}
        </CardContent>
        <CardFooter>{connectButton("Hubungkan ulang")}</CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Drive</CardTitle>
        <CardDescription>Terhubung</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Akun</dt>
          <dd>{connection.accountEmail}</dd>
          <dt className="text-muted-foreground">Folder utama</dt>
          <dd>
            <a
              href={`https://drive.google.com/drive/folders/${folders.rootFolderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Buka di Google Drive
            </a>
          </dd>
          <dt className="text-muted-foreground">Dihubungkan oleh</dt>
          <dd>
            {connection.connectedByName}, {formatWhen(connection.connectedAt)}
          </dd>
          <dt className="text-muted-foreground">Terakhir dipakai</dt>
          <dd>{connection.lastUsedAt ? formatWhen(connection.lastUsedAt) : "—"}</dd>
        </dl>
      </CardContent>
      {/* Periksa koneksi joins Hubungkan ulang here (#375). */}
      <CardFooter className="gap-2">{connectButton("Hubungkan ulang")}</CardFooter>
    </Card>
  );
}
