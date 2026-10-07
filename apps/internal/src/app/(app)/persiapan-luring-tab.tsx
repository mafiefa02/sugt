"use client";

import { PreparationChecklist } from "-/components/perjadin-preparation";
import { progressTone } from "-/components/progress-tone";
import { perjadinName, perjadinSchoolsLine } from "-/lib/perjadin-name";
import type { PreparationItem } from "@sugt/db/queries";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@sugt/ui/components/accordion";
import { Button } from "@sugt/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@sugt/ui/components/card";
import { Input } from "@sugt/ui/components/input";
import { cn } from "@sugt/ui/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  addWeeks,
  calendarDate,
  weekHref,
  weekOf,
  weekTitle,
  type WeekFigures,
} from "./persiapan-luring-derive";

/**
 * **The Dashboard's Persiapan Luring tab** (#423): how far the Preparation Checklists of one
 * Monday–Saturday week's Perjadins have got — a summary, a bar per item, and one card per Perjadin.
 *
 * **Read-only for everyone**, Staff included: the checklists render with every box disabled and no
 * toggle wired. Ticking happens on the Perjadin's own screen, `/perjadin` and `/pendamping`.
 *
 * **The week is in the URL** (`?minggu=`, its Monday), so it survives a reload and switching tabs.
 * The arrows, "Minggu ini" and the date field navigate; the server reads the week and folds it with
 * `deriveWeek`. The controls stay enabled while a week loads — disabling the focused one would drop
 * keyboard focus on every step — and the date field navigates only on Enter or **Lihat**, since a
 * date field reports a whole date after every digit typed into it.
 */
function PersiapanLuringTab({
  monday,
  currentWeek,
  figures,
}: {
  /** The Monday of the week on screen. */
  monday: string;
  /** The Monday of today's week (WIB), for "Minggu ini". */
  currentWeek: string;
  figures: WeekFigures;
}) {
  const router = useRouter();
  const [navigating, startNavigating] = useTransition();

  function go(week: string) {
    startNavigating(() => {
      router.push(weekHref(week) as Route, { scroll: false });
    });
  }

  const empty = figures.perjadins.length === 0;

  return (
    <div className="flex flex-col gap-4 px-4 py-6 sm:px-7">
      <Card aria-busy={navigating}>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base tabular-nums">{weekTitle(monday)}</CardTitle>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={monday === currentWeek}
              onClick={() => {
                go(currentWeek);
              }}
            >
              Minggu ini
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Minggu sebelumnya"
              onClick={() => {
                go(addWeeks(monday, -1));
              }}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Minggu berikutnya"
              onClick={() => {
                go(addWeeks(monday, 1));
              }}
            >
              <ChevronRight className="size-4" />
            </Button>
            <form
              className="flex items-center gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                // A date jumps to its week, a Sunday to the next one; an empty or unreal one does nothing.
                const date = calendarDate(
                  new FormData(event.currentTarget).get("tanggal")?.toString(),
                );
                if (date) go(weekOf(date));
              }}
            >
              <Input
                // Re-seeded with the week's Monday each time the week changes.
                key={monday}
                type="date"
                name="tanggal"
                aria-label="Pilih tanggal"
                className="w-auto"
                defaultValue={monday}
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
              >
                Lihat
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {empty ? (
            <p className="text-sm text-muted-foreground">Tidak ada Perjadin minggu ini</p>
          ) : (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-heading text-3xl font-medium tabular-nums">
                {figures.percent}%
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {figures.done}/{figures.total} item · {figures.perjadins.length} Perjadin
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {figures.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per item</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {figures.items.map((item) => (
                <li
                  key={item.itemId}
                  className="flex flex-col gap-1.5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="min-w-0 text-sm break-words">{item.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {item.done}/{item.applies} Perjadin · {item.percent}%
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-muted"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {!empty && (
        <Accordion className="flex flex-col gap-3">
          {figures.perjadins.map((trip) => {
            const schools = perjadinSchoolsLine(trip.schoolNames);
            return (
              <AccordionItem
                key={trip.id}
                value={trip.id}
                className="rounded-lg border border-border bg-card"
              >
                <AccordionTrigger className="items-start px-3 hover:no-underline sm:px-4">
                  <span className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="break-words">{perjadinName(trip)}</span>
                      {schools && (
                        <span className="text-xs font-normal break-words text-muted-foreground">
                          {schools}
                        </span>
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs font-normal">
                      <span className="text-muted-foreground">PIC: {trip.picFullName}</span>
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 font-medium tabular-nums",
                          progressTone(trip.done, trip.total),
                        )}
                      >
                        {trip.percent}%
                      </span>
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionPanel className="text-foreground">
                  <ReadOnlyChecklist items={trip.preparation} />
                </AccordionPanel>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}

/** A Perjadin's checklist as this tab shows it: every box disabled, no toggle wired. */
function ReadOnlyChecklist({ items }: { items: PreparationItem[] }) {
  return (
    <PreparationChecklist
      items={items}
      canToggle={false}
      onToggle={() => undefined}
    />
  );
}

export { PersiapanLuringTab, ReadOnlyChecklist };
