"use client";

import { ariaSort, type TableSort } from "-/components/table-sort";
import { TableHead, TableHeader, TableRow } from "@sugt/ui/components/table";
import { cn } from "@sugt/ui/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import type * as React from "react";

/**
 * **The app's sortable-table pieces** (#343): a table whose header stays pinned while the page
 * scrolls, a header cell that sorts, and a row that opens its record. Built for `/perjadin` and
 * reused by `/sesi-daring` (#344).
 *
 * They live in the app rather than in `@sugt/ui` because the sort state and the navigation are app
 * behaviour, and `@sugt/ui` stays presentational (ADR-0010). They compose the `@sugt/ui` table
 * primitives rather than restyling them, so a cell here looks like a cell on `/sekolah`.
 */

/**
 * The table, **without** the primitive's scroll container. `@sugt/ui`'s `Table` wraps itself in
 * `overflow-x-auto`, and any overflow other than `visible` makes that `div` the sticky header's
 * scrolling ancestor — one that never scrolls vertically, so `sticky top-0` would pin against it and
 * do nothing while the page scrolls. The primitive is left alone so `/sekolah` does not change.
 *
 * From `md` up the wrapper has no overflow, so the header pins against the page; below `md` it keeps
 * the horizontal scroll a narrow screen needs, and the header scrolls away with the rows there. The
 * app shell's sidebar is `sticky top-0` beside `<main>`, not above it, so nothing overlaps `top-0`.
 */
function StickyTable({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full max-md:overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

/**
 * The header row group, pinned to the top of the page. The background and the bottom rule are on
 * each `th`, not on the row: under the preflight's `border-collapse: collapse` a row's border stays
 * behind in the table's flow instead of travelling with the pinned header, so the rule is drawn as an
 * inset shadow the cell carries along.
 */
function StickyTableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <TableHeader
      className={cn(
        "sticky top-0 z-10 [&_th]:bg-background [&_th]:shadow-[inset_0_-1px_0_var(--color-border)] [&_tr]:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A header cell that sorts its column. The label is a `<button>`, so the header is reachable by
 * keyboard; `aria-sort` on the `th` says which column is sorted and which way, and the icon shows it.
 */
function SortableTableHead<K extends string>({
  column,
  sort,
  onSort,
  className,
  children,
}: {
  column: K;
  sort: TableSort<K>;
  onSort: (column: K) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const sorted = sort.key === column;
  const Icon = !sorted ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead
      aria-sort={ariaSort(sort, column)}
      className={className}
    >
      <button
        type="button"
        onClick={() => {
          onSort(column);
        }}
        className="inline-flex items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        {children}
        <Icon
          aria-hidden
          className={cn("size-3.5", !sorted && "text-muted-foreground/60")}
        />
      </button>
    </TableHead>
  );
}

/**
 * A row that opens `href` when clicked anywhere on it, highlighted on hover (the primitive's
 * `hover:bg-muted/50`) with a pointer cursor.
 *
 * **It is a convenience over a real link, not a replacement for one** — put a `next/link` to the same
 * `href` in the row's title cell so keyboard focus, ctrl-click and middle-click keep working. The row
 * does not act on a click that lands on a link, button or other control inside it, so that link
 * navigates once and a control such as a dialog trigger does its own thing. Nor on a click that did
 * not happen inside the row's own DOM: React bubbles events out of a portal to its React parent, so a
 * click inside a dialog opened from a cell would otherwise reach this row and navigate away.
 */
function ClickableTableRow<T extends string>({
  href,
  className,
  ...props
}: React.ComponentProps<"tr"> & { href: Route<T> }) {
  const router = useRouter();

  return (
    <TableRow
      className={cn("cursor-pointer", className)}
      onClick={(event) => {
        const target = event.target as Element;
        if (!event.currentTarget.contains(target)) return;
        if (target.closest("a, button, input, select, textarea, [role='button']")) return;
        router.push(href);
      }}
      {...props}
    />
  );
}

export { ClickableTableRow, SortableTableHead, StickyTable, StickyTableHeader };
