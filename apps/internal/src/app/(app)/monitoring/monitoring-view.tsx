"use client";

import { formatIdr } from "@sugt/domain";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@sugt/ui/components/accordion";
import { Alert, AlertAction, AlertDescription } from "@sugt/ui/components/alert";
import { Button } from "@sugt/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@sugt/ui/components/card";
import { Progress } from "@sugt/ui/components/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@sugt/ui/components/table";
import { cn } from "@sugt/ui/lib/utils";
import { Check } from "lucide-react";
import { useState } from "react";

import {
  DARING_MATRIX,
  KPI,
  LURING_MATRIX,
  TIMELINE,
  WARNINGS,
  type MockMatrixRow,
  type MockTimelineStep,
} from "./mock-data";
import { dismissWarning, initialWarningState } from "./monitoring-state";

const KLASTER = ["Klaster 1", "Klaster 2", "Klaster 3", "Klaster 4"] as const;

/**
 * The `/monitoring` view — a presentational scaffold (#178). **Everything it renders is mock**,
 * imported from `mock-data.ts`; the only state that moves is the operator setting warnings aside.
 *
 * That state is deliberately ephemeral. `useState` seeds the two warning lists once from the mock
 * warnings and the reducer (`dismissWarning`, the pure seam in `monitoring-state.ts`) moves an item
 * from `active` to `ignored` on **Abaikan** — a browser-only interaction with no persistence, which
 * is exactly right while the data is fake. When #177 makes the numbers real, this component keeps
 * its shape and swaps its source. `showBudget` gates the money card (ADR-0004), decided on the server.
 */
export function MonitoringView({ showBudget }: { showBudget: boolean }) {
  const [state, setState] = useState(() => initialWarningState(WARNINGS));

  return (
    <div className="flex flex-col gap-6 px-7 py-6">
      {/* Active warnings — one destructive Alert each; Abaikan sets it aside. */}
      {state.active.map((w) => (
        <Alert
          key={w.id}
          variant="destructive"
        >
          <AlertDescription>{w.message}</AlertDescription>
          <AlertAction>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setState((s) => dismissWarning(s, w.id))}
            >
              Abaikan
            </Button>
          </AlertAction>
        </Alert>
      ))}

      {/* Ignored warnings — always rendered, populates live as warnings are set aside. */}
      <Accordion>
        <AccordionItem>
          <AccordionTrigger>Peringatan yang diabaikan</AccordionTrigger>
          <AccordionPanel>
            {state.ignored.length === 0 ? (
              <p>Belum ada.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {state.ignored.map((w) => (
                  <li key={w.id}>{w.message}</li>
                ))}
              </ul>
            )}
          </AccordionPanel>
        </AccordionItem>
      </Accordion>

      {/* KPI cards. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Kegiatan terlaksana</CardDescription>
            <CardTitle className="font-heading text-3xl tabular-nums">
              {KPI.activitiesPercent}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={KPI.activitiesPercent} />
          </CardContent>
        </Card>

        {showBudget && (
          <Card>
            <CardHeader>
              <CardDescription>Penyerapan anggaran</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="font-heading text-2xl tabular-nums">
                    Rp {formatIdr(KPI.budget.usedIdr)}
                  </div>
                  <div className="text-sm text-muted-foreground">Anggaran terpakai</div>
                </div>
                <div className="text-right">
                  <div className="font-heading text-2xl tabular-nums">
                    Rp {formatIdr(KPI.budget.totalIdr)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total anggaran</div>
                </div>
              </div>
              <Progress value={KPI.budget.percent} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Timeline / stepper — horizontal, derived from each step's status. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lini masa pelaksanaan</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline steps={TIMELINE} />
        </CardContent>
      </Card>

      {/* Delivery matrices, one Card each. */}
      <MatrixCard
        title="Luring"
        rows={LURING_MATRIX}
      />
      <MatrixCard
        title="Daring"
        rows={DARING_MATRIX}
      />
    </div>
  );
}

/** A horizontal stepper: a filled, checked circle for completed steps, a muted ring for pending. */
function Timeline({ steps }: { steps: MockTimelineStep[] }) {
  return (
    <ol className="flex items-start">
      {steps.map((step, i) => {
        const completed = step.status === "completed";
        return (
          <li
            key={step.label}
            className="flex flex-1 flex-col items-center text-center"
          >
            <div className="flex w-full items-center">
              <div className="flex-1" />
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  completed
                    ? "bg-primary text-primary-foreground"
                    : "border-2 border-muted-foreground/40 text-muted-foreground",
                )}
              >
                {completed ? (
                  <Check className="size-4" />
                ) : (
                  <span className="text-sm">{i + 1}</span>
                )}
              </div>
              <div
                className={cn(
                  "h-0.5 flex-1",
                  i < steps.length - 1 ? "bg-primary" : "bg-transparent",
                )}
              />
            </div>
            <div className="mt-2 text-sm font-medium text-foreground">{step.label}</div>
            <div className="text-xs text-muted-foreground tabular-nums">{step.window}</div>
          </li>
        );
      })}
    </ol>
  );
}

/** One delivery matrix: Klaster columns across, session rows down, "completed/total" per cell. */
function MatrixCard({ title, rows }: { title: string; rows: MockMatrixRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Klaster</TableHead>
                {KLASTER.map((k) => (
                  <TableHead key={k}>{k}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.session}>
                  <TableCell className="font-medium">{row.session}</TableCell>
                  {row.cells.map((cell, i) => (
                    <TableCell
                      key={KLASTER[i]}
                      className="tabular-nums"
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
