import { requirePerson } from "-/lib/person";

import { showBudget } from "./monitoring-state";
import { MonitoringView } from "./monitoring-view";

/**
 * **Monitoring** — a one-screen overview of how far Session delivery has got and how much of the
 * Programme budget has been spent, across every Cluster. It ships (#178) as a **presentational
 * scaffold**: every number on it is a hard-coded mock, isolated in `mock-data.ts`, and wiring it to
 * real data is the follow-up (#177). Nothing here reads the database beyond `requirePerson()`.
 *
 * The server's only real decision is the money gate. `showBudget(person.role)` now returns `true`
 * for both signed-in roles — Staff and the read-only Pimpinan — because money is open to any
 * signed-in Person to READ (ADR-0004 reversed by ADR-0026, #180); the budget card shows to a
 * Pimpinan too, and writing money stays Staff-only elsewhere. The gate is computed here and passed
 * down; the view is otherwise a pure function of the mock module. All of that lives in
 * `monitoring-state.ts` (the pure, tested seam) and `mock-data.ts` (the figures) — see CONTEXT.md →
 * Open questions.
 */
export default async function Page() {
  const person = await requirePerson();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border px-7 py-5">
        <h1 className="font-heading text-lg font-medium">Monitoring</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ringkasan kemajuan pelaksanaan Sesi dan penyerapan anggaran Program di seluruh Klaster.
        </p>
      </header>

      <MonitoringView showBudget={showBudget(person.role)} />
    </div>
  );
}
