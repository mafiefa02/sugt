"use client";

import { loadParticipantFeedback } from "-/app/(app)/feedback/actions";
import { MODE_LABELS } from "-/components/session-labels";
import type {
  FeedbackCursor,
  FeedbackFilters,
  FeedbackFilterValue,
  ParticipantFeedbackRow,
} from "@sugt/db/queries";
import type { ClassKind } from "@sugt/domain";
import { Badge } from "@sugt/ui/components/badge";
import { Button } from "@sugt/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@sugt/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sugt/ui/components/select";
import { Tabs, TabsList, TabsTrigger } from "@sugt/ui/components/tabs";
import { useState, useTransition } from "react";

/**
 * **The Feedback screen, Peserta tab.** Three summary cards that never move, four server-side
 * filters, and a keyset-paged card list — all driven from one Server Action.
 *
 * **The averages are props and stay props.** They are dataset-wide and unfiltered by design
 * (`participantFeedbackAverages`), so nothing here recomputes them when the filters narrow the
 * list; the cards read the overall standing while the list below reads a slice of it.
 *
 * **Filtering and paging are the server's, not the browser's.** Unlike Concerns — where the low
 * Ratings are rare enough to ship whole and filter in memory — a submission is left by every
 * Participant of every Session, so the set is unbounded and both the filters and "load more" go
 * back to the query. A filter change refetches the first page (cursor `null`) and REPLACES the
 * list, resetting paging; "load more" fetches the next page and APPENDS it.
 *
 * Only a Peserta tab renders. The Perjadin tab is a blocked follow-up (#168), so there is no dead
 * trigger to click.
 */

/**
 * All filters off — the client's initial state, mirroring the server's `NO_FEEDBACK_FILTERS`.
 * Declared here rather than imported: `NO_FEEDBACK_FILTERS` is a runtime value on `@sugt/db`, and
 * importing a value from that package into a client component drags the Postgres client into the
 * browser bundle. This component takes only *types* from `@sugt/db/queries` for that reason, the
 * same rule `concerns-list.tsx` follows.
 */
const ALL_FILTERS: FeedbackFilters = {
  reviewType: "all",
  instructor: "all",
  materials: "all",
  relevance: "all",
};

/** GTK and MS keep their acronyms; a Participant of the student Class is a Siswa on screen. */
const CLASS_KIND_LABELS: Record<ClassKind, string> = {
  GTK: "GTK",
  MS: "MS",
  Student: "Siswa",
};

/** One filter's three options, in Indonesian. `label` prefixes name the column the filter gates. */
type FilterOptions = Record<FeedbackFilterValue, string>;

const REVIEW_TYPE_OPTIONS: FilterOptions = {
  all: "Semua Ulasan",
  le7: "Ulasan ≤ 7",
  gt7: "Ulasan > 7",
};

const INSTRUCTOR_OPTIONS: FilterOptions = {
  all: "Semua: Pengajar",
  le7: "Pengajar ≤ 7",
  gt7: "Pengajar > 7",
};

const MATERIALS_OPTIONS: FilterOptions = {
  all: "Semua: Materi",
  le7: "Materi ≤ 7",
  gt7: "Materi > 7",
};

const RELEVANCE_OPTIONS: FilterOptions = {
  all: "Semua: Relevansi",
  le7: "Relevansi ≤ 7",
  gt7: "Relevansi > 7",
};

function FeedbackView({
  initialRows,
  initialCursor,
  averages,
}: {
  initialRows: ParticipantFeedbackRow[];
  initialCursor: FeedbackCursor | null;
  averages: { instructor: number; materials: number; relevance: number };
}) {
  const [rows, setRows] = useState(initialRows);
  const [cursor, setCursor] = useState(initialCursor);
  const [filters, setFilters] = useState<FeedbackFilters>(ALL_FILTERS);
  const [pending, startTransition] = useTransition();

  // A filter change is a fresh first page (cursor null) that REPLACES the list. The pending state
  // covers the round trip so a second change cannot race the first.
  function changeFilter(key: keyof FeedbackFilters, value: FeedbackFilterValue) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    startTransition(async () => {
      const page = await loadParticipantFeedback(next, null);
      setRows(page.rows);
      setCursor(page.nextCursor);
    });
  }

  // "Load more" carries the current filters and the current cursor, and APPENDS what comes back.
  function loadMore() {
    if (cursor === null) return;
    startTransition(async () => {
      const page = await loadParticipantFeedback(filters, cursor);
      setRows((previous) => [...previous, ...page.rows]);
      setCursor(page.nextCursor);
    });
  }

  return (
    <div className="flex min-h-full flex-col p-7">
      <Tabs
        value="peserta"
        className="mb-5"
      >
        <TabsList>
          <TabsTrigger value="peserta">Peserta</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* The overall standing — dataset-wide, and unmoved by the filters below. */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AverageCard
          label="Pengajar"
          value={averages.instructor}
        />
        <AverageCard
          label="Materi"
          value={averages.materials}
        />
        <AverageCard
          label="Relevansi"
          value={averages.relevance}
        />
      </div>

      {/* The four server-side filters. Each change refetches the first page and resets paging. */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect
          ariaLabel="Jenis ulasan"
          options={REVIEW_TYPE_OPTIONS}
          value={filters.reviewType}
          disabled={pending}
          onChange={(value) => {
            changeFilter("reviewType", value);
          }}
        />
        <FilterSelect
          ariaLabel="Nilai Pengajar"
          options={INSTRUCTOR_OPTIONS}
          value={filters.instructor}
          disabled={pending}
          onChange={(value) => {
            changeFilter("instructor", value);
          }}
        />
        <FilterSelect
          ariaLabel="Nilai Materi"
          options={MATERIALS_OPTIONS}
          value={filters.materials}
          disabled={pending}
          onChange={(value) => {
            changeFilter("materials", value);
          }}
        />
        <FilterSelect
          ariaLabel="Nilai Relevansi"
          options={RELEVANCE_OPTIONS}
          value={filters.relevance}
          disabled={pending}
          onChange={(value) => {
            changeFilter("relevance", value);
          }}
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Tidak ada masukan Peserta untuk saringan ini.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <FeedbackCard row={row} />
            </li>
          ))}
        </ul>
      )}

      {cursor !== null && (
        <div className="mt-5 flex justify-center">
          <Button
            variant="outline"
            disabled={pending}
            onClick={loadMore}
          >
            {pending ? "Memuat…" : "Tampilkan lebih banyak"}
          </Button>
        </div>
      )}
    </div>
  );
}

/** One summary card: the Aspect's name over its dataset-wide average, kept to one decimal. */
function AverageCard({ label, value }: { label: string; value: number }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Nilai rata-rata · {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-heading text-2xl font-medium">{value.toFixed(1)}</p>
      </CardContent>
    </Card>
  );
}

/**
 * One filter dropdown. The value is always one of the three arms and never null, so no
 * placeholder branch — the trigger always shows the current option's label.
 */
function FilterSelect({
  ariaLabel,
  options,
  value,
  disabled,
  onChange,
}: {
  ariaLabel: string;
  options: FilterOptions;
  value: FeedbackFilterValue;
  disabled: boolean;
  onChange: (value: FeedbackFilterValue) => void;
}) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(next) => {
        onChange(next as FeedbackFilterValue);
      }}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className="w-full"
        disabled={disabled}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.entries(options) as [FeedbackFilterValue, string][]).map(([key, label]) => (
          <SelectItem
            key={key}
            value={key}
          >
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * One Participant's submission.
 *
 * The header names who left it, from which Class, at which School, in which mode, on which day,
 * with the row average as the headline number. The mode label is the mode word only — `Luring` /
 * `Daring` — because the data model carries no session ordinal to number them with (#168).
 *
 * Below it, the three Aspects in a fixed order, each with its score and — when the Participant
 * left one — the comment they wrote about that Aspect.
 */
function FeedbackCard({ row }: { row: ParticipantFeedbackRow }) {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium">{row.name}</span>
          <Badge variant="secondary">{CLASS_KIND_LABELS[row.classKind]}</Badge>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm text-muted-foreground">{row.schoolName}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm text-muted-foreground">{MODE_LABELS[row.sessionMode]}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm text-muted-foreground">{row.heldOn}</span>
          <span className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
            Rata-rata
            <AverageBadge value={row.rowAverage} />
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <AspectRow
          label="Pengajar"
          score={row.instructor}
          comment={row.instructorComment}
        />
        <AspectRow
          label="Materi"
          score={row.materials}
          comment={row.materialsComment}
        />
        <AspectRow
          label="Relevansi"
          score={row.relevance}
          comment={row.relevanceComment}
        />
      </CardContent>
    </Card>
  );
}

/**
 * One Aspect's line: its label, its score, and — only when there is one — the comment beneath.
 *
 * **The score's rendering is the concern signal.** A score at or below 7 is a red `destructive`
 * pill; a score above 7 is a plain bold number with no pill, so the eye lands on the low ones.
 */
function AspectRow({
  label,
  score,
  comment,
}: {
  label: string;
  score: number;
  comment: string | null;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        {score <= 7 ? (
          <Badge variant="destructive">{score}</Badge>
        ) : (
          <span className="text-sm font-bold">{score}</span>
        )}
      </div>
      {comment !== null && <Comment text={comment} />}
    </div>
  );
}

/**
 * The row average as a pill: red `destructive` at or below 7, neutral `secondary` above it. Unlike
 * a single Aspect's score — where a high one is a bare number — the average is always a pill, so
 * the headline number reads as a headline whether the row is a concern or not.
 */
function AverageBadge({ value }: { value: number }) {
  return <Badge variant={value <= 7 ? "destructive" : "secondary"}>{value.toFixed(1)}</Badge>;
}

/**
 * A Participant's comment, clamped to two lines with an inline "selengkapnya" / "sembunyikan"
 * toggle. Local state only — whether one comment is expanded is nobody else's business and not
 * worth a URL.
 */
function Comment({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-1">
      <p
        className={
          expanded ? "text-sm text-muted-foreground" : "line-clamp-2 text-sm text-muted-foreground"
        }
      >
        {text}
      </p>
      <button
        type="button"
        className="mt-0.5 text-xs font-medium text-primary hover:underline"
        onClick={() => {
          setExpanded((previous) => !previous);
        }}
      >
        {expanded ? "sembunyikan" : "selengkapnya"}
      </button>
    </div>
  );
}

export { FeedbackView };
