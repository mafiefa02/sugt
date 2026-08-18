"use client";

import { groupConcernsByAuthor } from "-/lib/concerns-grouping";
import type { Concern, ConcernAspect, ConcernSource } from "@sugt/db/queries";
import { Badge } from "@sugt/ui/components/badge";
import { Tabs, TabsList, TabsTrigger } from "@sugt/ui/components/tabs";
import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * The concerns list, filtered by source in the browser.
 *
 * **The filtering happens here, not in the query**, which keeps the screen one round trip:
 * a low Rating is rare and the whole set fits in memory, so the payload carries all of it and
 * the tabs narrow it without a second call.
 *
 * **The source is a tab and never a merge.** A professor's 3 on Comprehension and a student's 3
 * on Instructor are different claims; the rubrics never collide, so keeping them apart is the
 * whole point of the list. "Semua" is the default because the newest concern anywhere is the
 * one to see first.
 */

const SOURCE_LABELS: Record<ConcernSource, string> = {
  "class-record": "Catatan Kelas",
  "session-record": "Catatan Sesi",
  participant: "Peserta",
  "perjadin-evaluation": "Evaluasi Perjadin",
};

/**
 * The Aspect names in Indonesian — one map across all four rubrics, form copy at the edge the
 * way `CONTEXT.md` § *Language* asks. The keys are the Aspect columns; two labels repeat
 * (`facilities`, `timing`/`punctuality`) but never within one source, so a row is never
 * ambiguous once its source is shown.
 */
const ASPECT_LABELS: Record<ConcernAspect, string> = {
  comprehension: "Pemahaman",
  participation: "Partisipasi",
  readiness: "Kesiapan",
  materials: "Materi",
  delivery: "Penyampaian",
  facilities: "Fasilitas",
  timing: "Ketepatan waktu",
  turnout: "Kehadiran",
  school_support: "Dukungan sekolah",
  coordination: "Koordinasi",
  instructor: "Pengajar",
  relevance: "Relevansi",
  lodging: "Penginapan",
  transport: "Transportasi",
  meals: "Konsumsi",
  punctuality: "Ketepatan waktu",
};

type Filter = ConcernSource | "all";

const TABS: { value: Filter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "class-record", label: SOURCE_LABELS["class-record"] },
  { value: "session-record", label: SOURCE_LABELS["session-record"] },
  { value: "participant", label: SOURCE_LABELS.participant },
  { value: "perjadin-evaluation", label: SOURCE_LABELS["perjadin-evaluation"] },
];

function ConcernsList({ concerns }: { concerns: Concern[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(
    () => (filter === "all" ? concerns : concerns.filter((concern) => concern.source === filter)),
    [concerns, filter],
  );

  // Group the shown cards by author, client-side like the tab filter above. Grouping tells one
  // noisy rater flagging everything apart from many voices each flagging one thing.
  const groups = useMemo(() => groupConcernsByAuthor(shown), [shown]);

  return (
    <div className="flex min-h-full flex-col p-7">
      <Tabs
        value={filter}
        onValueChange={(value) => {
          setFilter(value as Filter);
        }}
        className="mb-5"
      >
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {concerns.length === 0
            ? "Belum ada Aspek yang dinilai rendah. Sejauh ini semuanya baik."
            : "Tidak ada catatan bernilai rendah untuk sumber ini."}
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={`${group.source}-${group.who}`}>
              {/*
                One header per author group: the name, the source label only under "Semua" (a
                single-source tab already names it), and the count. Cards stay newest-first within.
              */}
              <h2 className="mb-2 text-xs font-medium text-muted-foreground">
                {group.who}
                {filter === "all" && ` · ${SOURCE_LABELS[group.source]}`}
                {` · ${group.concerns.length}`}
              </h2>
              <ul className="space-y-2.5">
                {group.concerns.map((concern, index) => (
                  <ConcernRow
                    key={`${concern.aspect}-${index}`}
                    concern={concern}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** The wrapper's classes, whether the row links or not, so the two branches read the same. */
const ROW_LINK_CLASS = "block rounded-lg transition-colors hover:bg-muted/40";

/**
 * One low Rating: what it was against, how low, the prose if any, and who said it.
 *
 * The link is inlined per source rather than computed into a variable, because Next's typed
 * routes need the literal `/sesi/[id]` and `/perjadin/[id]` templates to check them — a plain
 * `string` erases the route type.
 */
function ConcernRow({ concern }: { concern: Concern }) {
  const body = (
    <div className="rounded-lg border border-border p-3.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge variant="secondary">{SOURCE_LABELS[concern.source]}</Badge>
        <span className="text-sm text-foreground">{concern.subject}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-sm font-medium">{ASPECT_LABELS[concern.aspect]}</span>
        <Badge variant="destructive">{concern.rating}</Badge>
      </div>

      {/*
        The prose, when there is any: an internal filer's mandatory explanation, or a Participant's
        optional comment. Absent when a Participant left theirs blank — they owe no elaboration.
      */}
      {concern.said !== null && (
        <p className="mt-2 text-sm text-muted-foreground">{concern.said}</p>
      )}

      <p className="mt-1.5 text-xs text-muted-foreground">{concern.who}</p>
    </div>
  );

  if (concern.perjadinId !== null) {
    return (
      <li>
        <Link
          href={`/perjadin/${concern.perjadinId}`}
          className={ROW_LINK_CLASS}
        >
          {body}
        </Link>
      </li>
    );
  }
  if (concern.sessionId !== null) {
    return (
      <li>
        <Link
          href={`/sesi/${concern.sessionId}`}
          className={ROW_LINK_CLASS}
        >
          {body}
        </Link>
      </li>
    );
  }
  return <li>{body}</li>;
}

export { ConcernsList };
