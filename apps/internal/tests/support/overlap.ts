import { db } from "@sugt/db";
import { sql } from "drizzle-orm";

/**
 * Run `calls` concurrently so that **each has read before any can insert** into `table` — the
 * window a read-then-insert write races in. Without it, two "concurrent" calls on an idle machine
 * usually finish one after the other, and a test of their race passes whether or not the write
 * guards it (#453's first version did, with its row lock removed).
 *
 * A transaction holds `share` on `table` — reads pass, every insert waits — until `waiting` other
 * connections are blocked on a lock, then lets go. A write that serializes on a row lock shows up
 * as one call waiting on the table and the rest on that row; one that does not, as every call
 * waiting on the table with its read already done. Both reach `waiting`, so the hold never decides
 * the outcome, only the overlap.
 */
export async function overlappingAtInsert<T>(
  table: string,
  calls: (() => Promise<T>)[],
): Promise<T[]> {
  let running: Promise<T[]> | undefined;
  await db.transaction(async (tx) => {
    await tx.execute(sql`lock table ${sql.identifier(table)} in share mode`);
    running = Promise.all(calls.map((call) => call()));
    // Settled below, after the hold is released; this keeps a rejection from going unhandled.
    running.catch(() => {});
    await untilWaitingOnALock(calls.length);
  });
  return running!;
}

async function untilWaitingOnALock(count: number) {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const [row] = await db.execute<{ waiting: number }>(sql`
      select count(*)::int as waiting
      from pg_stat_activity
      where datname = current_database() and wait_event_type = 'Lock'
    `);
    if ((row?.waiting ?? 0) >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Never saw ${count} connections waiting on a lock.`);
}
