import { StickyTable, StickyTableHeader } from "-/components/sortable-table";
import { driveFileUrl, driveFolderUrl } from "-/lib/drive/receipt-files";
import { formatWibIndonesian } from "-/lib/format-wib";
import { perjadinName, perjadinSchoolsLine } from "-/lib/perjadin-name";
import { requirePerson } from "-/lib/person";
import {
  ACTIVITY_LOG_AKSI_FILTERS,
  activityLogAksi,
  activityLogPage,
  activityLogRincian,
  hasGrant,
  type ActivityLogRow,
} from "@sugt/db/queries";
import { Button } from "@sugt/ui/components/button";
import { Input } from "@sugt/ui/components/input";
import { Label } from "@sugt/ui/components/label";
import { LinkButton } from "@sugt/ui/components/link-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sugt/ui/components/select";
import { TableBody, TableCell, TableHead, TableRow } from "@sugt/ui/components/table";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";

import { logHref, parseLogParams } from "./log-params";

export const metadata: Metadata = { title: "Log" };

/** The Aksi dropdown's value for "no filter" — never a `?aksi=` the parser accepts. */
const SEMUA = "semua";

const AKSI_ITEMS: Record<string, string> = {
  [SEMUA]: "Semua",
  ...Object.fromEntries(
    Object.entries(ACTIVITY_LOG_AKSI_FILTERS).map(([key, filter]) => [key, filter.label]),
  ),
};

/**
 * **Log** (#395) — the Activity Log, Administrator only: who did what to a Perjadin's money,
 * receipts, documents and report, and when. Newest first, 50 a page.
 *
 * Anyone else, a Pimpinan included, gets `forbidden()` and the 403, as on `/pengaturan`; the
 * sidebar hides the link from the same people. `activityLogPage` checks Administrator again.
 *
 * **Everything the view shows is in the URL** (`?q=&aksi=&dari=&sampai=&page=`), so a view can be
 * bookmarked: the filters are a plain GET form, and paging is two links. The page is rendered per
 * request and never cached or polled — a new entry appears on the next load or filter change.
 */
export default async function Page({ searchParams }: PageProps<"/log">) {
  const person = await requirePerson();
  if (!hasGrant(person, "Administrator")) forbidden();

  const filters = parseLogParams(await searchParams);
  const log = await activityLogPage(person, filters);
  const filtered = Boolean(filters.q || filters.aksi || filters.dari || filters.sampai);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border px-4 py-5 sm:px-7">
        <h1 className="font-heading text-lg font-medium">Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Siapa mengubah uang, bukti, dokumen, dan laporan sebuah Perjadin, dan kapan. Yang terbaru
          di atas; muat ulang halaman untuk melihat entri baru.
        </p>
      </header>

      <form
        action="/log"
        method="get"
        className="flex flex-wrap items-end gap-3 px-4 pt-5 sm:px-7"
      >
        {/* Below `sm` the search and the date range take the whole width and the two dates stack, so
            the form fits a 360px phone (#418). */}
        <div className="grid w-full gap-1.5 sm:w-auto">
          <Label htmlFor="log-q">Cari</Label>
          <Input
            id="log-q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Email, Perjadin, PIC, atau rincian"
            className="w-full sm:w-72"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="log-aksi">Aksi</Label>
          <Select
            name="aksi"
            items={AKSI_ITEMS}
            defaultValue={filters.aksi ?? SEMUA}
          >
            <SelectTrigger
              id="log-aksi"
              className="w-48"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(AKSI_ITEMS).map(([value, label]) => (
                <SelectItem
                  key={value}
                  value={value}
                >
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <fieldset className="grid w-full min-w-0 gap-1.5 sm:w-auto">
          <legend className="mb-1.5 text-sm font-medium">Rentang tanggal</legend>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              name="dari"
              type="date"
              aria-label="Dari tanggal"
              defaultValue={filters.dari ?? ""}
              className="w-full sm:w-40"
            />
            <span className="text-sm text-muted-foreground">sampai</span>
            <Input
              name="sampai"
              type="date"
              aria-label="Sampai tanggal"
              defaultValue={filters.sampai ?? ""}
              className="w-full sm:w-40"
            />
          </div>
        </fieldset>
        <Button type="submit">Terapkan</Button>
        {filtered && (
          <LinkButton
            variant="ghost"
            render={<Link href="/log" />}
          >
            Hapus saringan
          </LinkButton>
        )}
      </form>

      {log.rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-7">
          {filtered ? "Tidak ada entri yang cocok dengan saringan ini." : "Belum ada entri."}
        </p>
      ) : (
        <div className="mt-3 px-2 sm:px-5">
          <StickyTable>
            <StickyTableHeader>
              <TableRow>
                <TableHead>Waktu (WIB)</TableHead>
                <TableHead>Oleh</TableHead>
                <TableHead>Perjadin</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Rincian</TableHead>
              </TableRow>
            </StickyTableHeader>
            <TableBody>
              {log.rows.map((row) => (
                <LogRow
                  key={row.id}
                  row={row}
                />
              ))}
            </TableBody>
          </StickyTable>
        </div>
      )}

      <nav
        aria-label="Halaman"
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm text-muted-foreground sm:px-7"
      >
        <span>
          {log.total} entri · halaman {log.page} dari {log.pageCount}
        </span>
        <div className="flex gap-2">
          {log.page > 1 && (
            <LinkButton
              variant="outline"
              size="sm"
              render={<Link href={logHref(filters, log.page - 1) as Route} />}
            >
              Sebelumnya
            </LinkButton>
          )}
          {log.page < log.pageCount && (
            <LinkButton
              variant="outline"
              size="sm"
              render={<Link href={logHref(filters, log.page + 1) as Route} />}
            >
              Berikutnya
            </LinkButton>
          )}
        </div>
      </nav>
    </div>
  );
}

function LogRow({ row }: { row: ActivityLogRow }) {
  return (
    <TableRow className="align-top">
      <TableCell className="text-muted-foreground tabular-nums">
        {formatWibIndonesian(row.occurredAt)}
      </TableCell>
      <TableCell>{row.actorEmail}</TableCell>
      <TableCell className="min-w-64 whitespace-normal">
        <Link
          href={`/perjadin/${row.perjadin.id}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {perjadinName(row.perjadin)}
        </Link>
        <span className="text-muted-foreground"> — PIC: {row.perjadin.picName}</span>
        {row.perjadin.schoolNames.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {perjadinSchoolsLine(row.perjadin.schoolNames)}
          </p>
        )}
      </TableCell>
      <TableCell>{activityLogAksi(row.action, row.backfilled)}</TableCell>
      <TableCell className="min-w-64 whitespace-normal">
        {activityLogRincian(row)}
        {row.driveFolderId && (
          <>
            {" · "}
            <a
              href={driveFolderUrl(row.driveFolderId)}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              Buka folder
            </a>
          </>
        )}
        {row.documentFileId && (
          <>
            {" · "}
            <a
              href={driveFileUrl(row.documentFileId)}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              Buka
            </a>
          </>
        )}
      </TableCell>
    </TableRow>
  );
}
