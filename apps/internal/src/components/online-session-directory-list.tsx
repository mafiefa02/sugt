"use client";

import {
  ONLINE_SESSION_DEFAULT_SORT,
  sortOnlineSessionDirectory,
  type OnlineSessionColumn,
} from "-/components/online-session-directory-sort";
import { SessionStatusBadge } from "-/components/session-labels";
import {
  ClickableTableRow,
  SortableTableHead,
  StickyTable,
  StickyTableHeader,
} from "-/components/sortable-table";
import { nextTableSort, type TableSort } from "-/components/table-sort";
import type { DirectoryOnlineSession } from "@sugt/db/queries";
import { formatWallClockTime } from "@sugt/domain";
import { Input } from "@sugt/ui/components/input";
import { TableBody, TableCell, TableHead, TableRow } from "@sugt/ui/components/table";
import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * The online-Session table, narrowed by a search box (#333) and sorted by Tanggal (#344).
 *
 * **The filtering and sorting happen here and not in the query.** The page fetches every online
 * Session and hands the full array down; the browser narrows it as you type, the same one-round-trip
 * shape `SchoolDirectoryTable` uses — the list is bounded and its payload already carries every field
 * the search reads. Search matches the School name, the only text on a row worth scanning for.
 *
 * Built from the `/perjadin` table's shared pieces (#343): the header stays in view while the list
 * scrolls, and a row opens its Session. **Only Tanggal sorts** — newest first, a click flips it — so
 * the other headers are the plain `TableHead`, with no button and no icon to suggest otherwise. The
 * two time columns name WIB once in the header, since an online Session is always WIB (#283), and the
 * cells show the bare `HH:MM`.
 */
function OnlineSessionDirectoryList({ sessions }: { sessions: DirectoryOnlineSession[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TableSort<OnlineSessionColumn>>(ONLINE_SESSION_DEFAULT_SORT);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching =
      needle === ""
        ? sessions
        : sessions.filter((session) => session.schoolName.toLowerCase().includes(needle));
    return sortOnlineSessionDirectory(matching, sort);
  }, [sessions, query, sort]);

  return (
    <div className="flex min-h-full flex-col">
      <div className="px-4 pt-5 sm:px-7">
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Cari Sekolah"
          aria-label="Cari Sekolah"
          className="h-8 w-full max-w-72"
        />
        <p className="mt-2.5 text-xs text-muted-foreground">
          Menampilkan {shown.length} dari {sessions.length} Sesi daring
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-7">
          Tidak ada Sesi daring yang cocok dengan pencarian ini.
        </p>
      ) : (
        <div className="mt-3 px-2 sm:px-5">
          <StickyTable>
            <StickyTableHeader>
              <TableRow>
                <TableHead>Sekolah</TableHead>
                <SortableTableHead
                  column="heldOn"
                  sort={sort}
                  onSort={(column) => {
                    setSort((current) => nextTableSort(current, column));
                  }}
                >
                  Tanggal
                </SortableTableHead>
                <TableHead>Jam Mulai (WIB)</TableHead>
                <TableHead>Jam Selesai (WIB)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </StickyTableHeader>
            <TableBody>
              {shown.map((session) => (
                <ClickableTableRow
                  key={session.id}
                  href={`/sesi-daring/${session.id}`}
                >
                  {/* The School as plain text that links to the Session, not to `/sekolah/…`: the
                      row opens the Session, and this real link keeps keyboard focus, ctrl-click and
                      middle-click working for it. */}
                  <TableCell className="font-medium whitespace-normal">
                    <Link
                      href={`/sesi-daring/${session.id}`}
                      className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
                    >
                      {session.schoolName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {session.heldOn}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatWallClockTime(session.startsAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {session.endsAt === null ? "—" : formatWallClockTime(session.endsAt)}
                  </TableCell>
                  <TableCell>
                    <SessionStatusBadge status={session.status} />
                  </TableCell>
                </ClickableTableRow>
              ))}
            </TableBody>
          </StickyTable>
        </div>
      )}
    </div>
  );
}

export { OnlineSessionDirectoryList };
