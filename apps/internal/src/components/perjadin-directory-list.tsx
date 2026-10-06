"use client";

import {
  PERJADIN_DEFAULT_SORT,
  sortPerjadinDirectory,
  type PerjadinColumn,
} from "-/components/perjadin-directory-sort";
import { PerjadinPreparationDialog } from "-/components/perjadin-preparation";
import { progressTone } from "-/components/progress-tone";
import {
  ClickableTableRow,
  SortableTableHead,
  StickyTable,
  StickyTableHeader,
} from "-/components/sortable-table";
import { nextTableSort, type TableSort } from "-/components/table-sort";
import { shortenKabupaten } from "-/lib/format-destination";
import type { DirectoryPerjadin } from "@sugt/db/queries";
import { Input } from "@sugt/ui/components/input";
import { TableBody, TableCell, TableRow } from "@sugt/ui/components/table";
import { cn } from "@sugt/ui/lib/utils";
import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * The Perjadin table, narrowed by a search box and sorted by any column (#343).
 *
 * **The filtering and sorting happen here and not in the query**, the one-round-trip shape
 * `SchoolDirectoryTable` uses: the page fetches every trip — carrying the three name arrays the
 * search reads (#334) — and the browser narrows and orders them. A trip matches when the query is a
 * case-insensitive substring of its **destination** (a Perjadin has no separate name — the
 * destination is its identity), its **PIC** name, or any of its **pengajar**, **Group-member** or
 * **School** names. Those three arrays are search-only: nothing below renders them.
 *
 * Sorting defaults to Mulai, newest first; the sort state is `useState`, not the URL. A row
 * opens the trip on click, and its title is a real link besides. **Persiapan** is the checklist
 * dialog's trigger for Staff (`canTogglePreparation`) and a static pill for anyone else.
 */
function PerjadinDirectoryList({
  trips,
  canTogglePreparation,
}: {
  trips: DirectoryPerjadin[];
  canTogglePreparation: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TableSort<PerjadinColumn>>(PERJADIN_DEFAULT_SORT);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching =
      needle === ""
        ? trips
        : trips.filter((trip) => {
            const haystack = [
              trip.destination,
              trip.picFullName,
              ...trip.pengajarNames,
              ...trip.groupMemberNames,
              ...trip.schoolNames,
            ];
            return haystack.some((field) => field.toLowerCase().includes(needle));
          });
    return sortPerjadinDirectory(matching, sort);
  }, [trips, query, sort]);

  function sortBy(column: PerjadinColumn) {
    setSort((current) => nextTableSort(current, column));
  }

  const head = { sort, onSort: sortBy };

  return (
    <div className="flex min-h-full flex-col">
      <div className="px-7 pt-5">
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Cari Perjadin"
          aria-label="Cari Perjadin"
          className="h-8 w-full max-w-72"
        />
        <p className="mt-2.5 text-xs text-muted-foreground">
          Menampilkan {shown.length} dari {trips.length} Perjadin
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="px-7 py-10 text-center text-sm text-muted-foreground">
          Tidak ada Perjadin yang cocok dengan pencarian ini.
        </p>
      ) : (
        <div className="mt-3 px-5">
          <StickyTable>
            <StickyTableHeader>
              <TableRow>
                <SortableTableHead
                  column="destination"
                  {...head}
                >
                  Perjadin
                </SortableTableHead>
                <SortableTableHead
                  column="schools"
                  className="text-right"
                  {...head}
                >
                  Sekolah
                </SortableTableHead>
                <SortableTableHead
                  column="start"
                  {...head}
                >
                  Mulai
                </SortableTableHead>
                <SortableTableHead
                  column="end"
                  {...head}
                >
                  Selesai
                </SortableTableHead>
                <SortableTableHead
                  column="pic"
                  {...head}
                >
                  PIC
                </SortableTableHead>
                <SortableTableHead
                  column="preparation"
                  {...head}
                >
                  Persiapan
                </SortableTableHead>
                <SortableTableHead
                  column="delivered"
                  {...head}
                >
                  Terlaksana
                </SortableTableHead>
              </TableRow>
            </StickyTableHeader>
            <TableBody>
              {shown.map((trip) => (
                <ClickableTableRow
                  key={trip.id}
                  href={`/perjadin/${trip.id}`}
                >
                  {/* The title wraps, so a long destination does not push the table past the page. */}
                  <TableCell className="min-w-56 font-medium whitespace-normal">
                    <Link
                      href={`/perjadin/${trip.id}`}
                      className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
                    >
                      {shortenKabupaten(trip.destination)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{trip.schoolCount}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {trip.startsOn}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {trip.endsOn}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{trip.picFullName}</TableCell>
                  <TableCell>
                    <PreparationPill
                      trip={trip}
                      canToggle={canTogglePreparation}
                    />
                  </TableCell>
                  <TableCell>
                    <CountBadge
                      done={trip.sessionsDelivered}
                      total={trip.sessionsTotal}
                    />
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

/** An `x/N` badge in the shared progress tone — Terlaksana's, and the static Persiapan pill's. */
function CountBadge({ done, total }: { done: number; total: number }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        progressTone(done, total),
      )}
    >
      {done}/{total}
    </span>
  );
}

/**
 * **The Persiapan pill** ([#114](https://github.com/mafiefa02/sugt/issues/114)), `x/N` in the shared
 * progress tone. For Staff it is the trigger of the checklist dialog, toggleable — the same pill the
 * `/pendamping` card wears (`my-perjadin-section.tsx`); for anyone else it is a static badge.
 * Opening the dialog never also opens the trip: `ClickableTableRow` ignores a click on a button, and
 * one inside the dialog's portal, so the click stops short of the row's navigation.
 */
function PreparationPill({ trip, canToggle }: { trip: DirectoryPerjadin; canToggle: boolean }) {
  if (!canToggle) {
    return (
      <CountBadge
        done={trip.preparationDone}
        total={trip.preparationTotal}
      />
    );
  }

  return (
    <PerjadinPreparationDialog
      perjadinId={trip.id}
      items={trip.preparation}
      canToggle
      trigger={
        <button
          type="button"
          aria-label={`Persiapan ${trip.preparationDone} dari ${trip.preparationTotal}`}
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums transition-opacity hover:opacity-80",
            progressTone(trip.preparationDone, trip.preparationTotal),
          )}
        >
          {trip.preparationDone}/{trip.preparationTotal}
        </button>
      }
    />
  );
}

export { PerjadinDirectoryList };
