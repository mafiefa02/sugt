"use client";

import type { CoverageCluster, CoverageSchool } from "@sugt/db/queries";
import { TOTAL_SESSIONS_PER_SCHOOL } from "@sugt/domain";
import { Button } from "@sugt/ui/components/button";
import { Checkbox } from "@sugt/ui/components/checkbox";
import { Progress } from "@sugt/ui/components/progress";
import { cn } from "@sugt/ui/lib/utils";
import type { Route } from "next";
import Link from "next/link";
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
 * **Selecting is open to anyone signed in; the two actions are not.** Both halves are
 * the spec's rather than an inference: Coverage's row on the surface list reads *"who:
 * signed in"*, and [#25](https://github.com/mafiefa02/sugt/issues/25) says a Staff
 * **or** Teaching Team member *"can select several of them"* — while Rencanakan
 * Perjadin and Jadwalkan Sesi daring are both Staff. So a Teaching Team member selects
 * and is shown what they selected, and the two Staff actions are **absent** rather
 * than offered and refused.
 */
function CoverageList({ clusters, canPlan }: { clusters: CoverageCluster[]; canPlan: boolean }) {
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
                  school={school}
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

      {selected.size > 0 && (
        <SelectionBar
          selected={selected}
          canPlan={canPlan}
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
 * **It shows counts and nothing else.** Nothing is ever overdue, because no Session
 * ever asserted a due date, so a School behind on pace shows a low number and noticing
 * that is a human reading it. Pace and health are different questions, and Concerns is
 * the other screen.
 *
 * The meter is the design handoff's, and it restates the count rather than judging it:
 * one length, one colour, no ramp and no threshold. That is the distinction
 * `docs/product.md` draws when it rules out a health indicator — a Rating's severity
 * ramp belongs to the two Rating controls, and deliberately not here.
 *
 * The Checkbox is the control and the School's name labels it. The row is not itself
 * clickable: a `<label>` around a Base UI Checkbox has two plausible targets — the
 * `role="checkbox"` button and the visually-hidden input beside it — and which one a
 * click lands on decides whether the toggle fires once or twice. The primitive already
 * carries an enlarged hit area for this reason.
 */
function SchoolRow({
  school,
  selected,
  onToggle,
}: {
  school: CoverageSchool;
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
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        aria-labelledby={nameId}
      />

      <span
        id={nameId}
        className="flex-1 text-sm font-medium"
      >
        {school.name}
      </span>
      <span className="hidden text-xs text-muted-foreground sm:inline">{school.kabupatenKota}</span>

      <span className="text-[13px] text-muted-foreground tabular-nums">
        {school.deliveredSessions} / {TOTAL_SESSIONS_PER_SCHOOL}
      </span>
      <Progress
        className="w-21 shrink-0"
        value={school.deliveredSessions}
        max={TOTAL_SESSIONS_PER_SCHOOL}
        aria-label={`${school.name}: ${school.deliveredSessions} dari ${TOTAL_SESSIONS_PER_SCHOOL} Sesi terlaksana`}
      />
    </div>
  );
}

/**
 * What a selection offers, and it **stays unavailable until something is selected** —
 * this bar is absent otherwise. Coverage is where trip planning starts: the delivered
 * counts are what decides where a Group goes next, so the decision gets made in front
 * of them rather than from memory.
 *
 * A Teaching Team member sees the count and Batal. The two actions are Staff-only
 * surfaces, and a Staff-only surface is absent rather than shown and refused.
 *
 * **Jadwalkan Sesi daring is a link and Rencanakan Perjadin is still a disabled
 * button**, and the difference is not stylistic: `typedRoutes` is on, so a `Link` to a
 * route nobody has built does not typecheck. One of the two destinations now exists.
 *
 * The selection travels in the URL rather than in a store, because it is transient —
 * thrown away on navigation, and an argument to the next screen rather than anything
 * stored. `Route` is asserted on the query string for the same `typedRoutes` reason:
 * the generated type knows the pathname and cannot know a runtime-built query.
 */
function SelectionBar({
  selected,
  canPlan,
  onClear,
}: {
  selected: ReadonlySet<string>;
  canPlan: boolean;
  onClear: () => void;
}) {
  const arrangeOnline = `/jadwalkan-sesi-daring?sekolah=${[...selected].join(",")}` as Route;

  return (
    <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-7 py-3.5 shadow-lg">
      <div>
        <span className="text-sm">
          <b>{selected.size}</b> Sekolah dipilih
        </span>
        {canPlan && (
          <p className="text-xs text-muted-foreground">
            Rencanakan Perjadin belum dibangun — lihat issue #29.
          </p>
        )}
      </div>

      <div className="flex gap-2.5">
        <Button
          variant="ghost"
          onClick={onClear}
        >
          Batal
        </Button>
        {canPlan && (
          <>
            <Button
              variant="outline"
              render={<Link href={arrangeOnline} />}
            >
              Jadwalkan Sesi daring
            </Button>
            <Button
              disabled
              title="Rencanakan Perjadin — issue #29"
            >
              Rencanakan Perjadin
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export { CoverageList };
