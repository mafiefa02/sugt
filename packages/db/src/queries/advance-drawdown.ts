import { ADVANCE_DRAWDOWN_CATEGORIES } from "@sugt/domain";
import { sql, type SQL } from "drizzle-orm";

/**
 * The `('Konsumsi', 'Lainnya')` value list for a `category in (…)` filter on the **travel-float
 * draw-down** (ADR-0029), built from `ADVANCE_DRAWDOWN_CATEGORIES` so the SQL remainder in
 * `myPerjadin` cannot drift from the domain constant. Each category is a bound placeholder, never
 * interpolated. The JS acquittal uses `sumAdvanceDrawdownIdr` for the identical rule; a test pins
 * the two equal.
 */
export function advanceDrawdownCategoryList(): SQL {
  return sql.join(
    ADVANCE_DRAWDOWN_CATEGORIES.map((category) => sql`${category}`),
    sql`, `,
  );
}
