"use client";

import type { CoverageCluster } from "@sugt/db/queries";
import { Button } from "@sugt/ui/components/button";
import { Checkbox } from "@sugt/ui/components/checkbox";
import { Progress } from "@sugt/ui/components/progress";
import { cn } from "@sugt/ui/lib/utils";
import { useId, useState } from "react";

/**
 * Coverage's Schools, grouped by Cluster, with the selection the two trip-planning
 * actions start from.
 *
 * A client component because the selection lives in the URL of nothing — it is
 * transient, it is thrown away on navigation, and the two actions it feeds take it as
 * an argument rather than as a stored state. The counts arrive from the server as
 * props; nothing here fetches.
 *
 * **`selectable` is a role decision made one layer up.** Both of Coverage's actions
 * are Staff-only, so a Teaching Team member gets the counts and no checkboxes at all
 * — not checkboxes that lead nowhere. Absent rather than disabled is the rule the
 * whole tool follows for Staff-only work, and offering a selection that buys nothing
 * is exactly the advertising it exists to prevent.
 */

/** The denominator, passed in rather than read here: it belongs to `@sugt/domain`. */
type CoverageListProps = {
  clusters: CoverageCluster[];
  sessionsPerSchool: number;
  selectable: boolean;
};

function CoverageList({ clusters, sessionsPerSchool, selectable }: CoverageListProps) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  function toggle(schoolId: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (!next.delete(schoolId)) next.add(schoolId);
      return next;
    });
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 p-7">
        {clusters.map((cluster) => (
          <section
            key={cluster.id}
            className="mb-7"
          >
            <div className="mb-2.5 flex items-baseline gap-2.5">
              <h2 className="font-heading text-base font-semibold">{cluster.name}</h2>
              <span className="text-xs text-muted-foreground">Topik: {cluster.topic}</span>
            </div>

            <div className="border-t border-border">
              {cluster.schools.map((school) => (
                <SchoolRow
                  key={school.id}
                  name={school.name}
                  kabupatenKota={school.kabupatenKota}
                  deliveredSessions={school.deliveredSessions}
                  sessionsPerSchool={sessionsPerSchool}
                  selectable={selectable}
                  selected={selected.has(school.id)}
                  onToggle={() => {
                    toggle(school.id);
                  }}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {selectable && selected.size > 0 && (
        <SelectionBar
          count={selected.size}
          onClear={() => {
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}

/**
 * One School: how much teaching has happened, against the fixed ten.
 *
 * **It shows counts and nothing else** — no health indicator, no flagging, no colour.
 * Nothing is ever overdue, because no Session ever asserted a due date, so a School
 * behind on pace shows a low number and noticing that is a human reading it. Pace and
 * health are different questions and Concerns is the other screen.
 *
 * The Checkbox is the control and the School's name labels it. The row is not itself
 * clickable: a `<label>` around a Base UI Checkbox has two plausible targets — the
 * `role="checkbox"` button and the visually-hidden input beside it — and which one a
 * click lands on decides whether the toggle fires once or twice. The primitive
 * already carries an enlarged hit area for this reason.
 */
function SchoolRow({
  name,
  kabupatenKota,
  deliveredSessions,
  sessionsPerSchool,
  selectable,
  selected,
  onToggle,
}: {
  name: string;
  kabupatenKota: string;
  deliveredSessions: number;
  sessionsPerSchool: number;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const nameId = useId();

  return (
    <div
      className={cn(
        "flex items-center gap-3.5 border-b border-border px-4 py-3",
        selected && "bg-primary/8",
      )}
    >
      {selectable && (
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-labelledby={nameId}
        />
      )}

      <span
        id={nameId}
        className="flex-1 text-sm font-medium"
      >
        {name}
      </span>
      <span className="hidden text-xs text-muted-foreground sm:inline">{kabupatenKota}</span>

      <span className="text-[13px] text-muted-foreground tabular-nums">
        {deliveredSessions} / {sessionsPerSchool}
      </span>
      <Progress
        className="w-21 shrink-0"
        value={deliveredSessions}
        max={sessionsPerSchool}
        aria-label={`${name}: ${deliveredSessions} dari ${sessionsPerSchool} Sesi terlaksana`}
      />
    </div>
  );
}

/**
 * The two actions, and they **stay unavailable until something is selected** — this
 * bar is absent otherwise. Coverage is where trip planning starts: the delivered
 * counts are what decides where a Group goes next, so the decision gets made in front
 * of them rather than from memory.
 *
 * Both buttons are disabled because neither destination exists yet. They are buttons
 * rather than links deliberately: `typedRoutes` is on, so a `Link` to a route nobody
 * has built does not typecheck — which is the same guard that gave every sidebar
 * destination a placeholder page.
 */
function SelectionBar({ count, onClear }: { count: number; onClear: () => void }) {
  return (
    <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-7 py-3.5 shadow-lg">
      <div>
        <span className="text-sm">
          <b>{count}</b> Sekolah dipilih
        </span>
        <p className="text-xs text-muted-foreground">
          Kedua tindakan ini belum dibangun — lihat issue #29 dan #27.
        </p>
      </div>

      <div className="flex gap-2.5">
        <Button
          variant="ghost"
          onClick={onClear}
        >
          Batal
        </Button>
        <Button
          variant="outline"
          disabled
          title="Jadwalkan Sesi daring — issue #27"
        >
          Jadwalkan Sesi daring
        </Button>
        <Button
          disabled
          title="Rencanakan Perjadin — issue #29"
        >
          Rencanakan Perjadin
        </Button>
      </div>
    </div>
  );
}

export { CoverageList };
