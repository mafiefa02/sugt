import { DashboardWarnings } from "-/app/(app)/dashboard-warnings";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * **The Dashboard Peringatan card's first render** (#458): collapsed on every visit, so the server
 * HTML carries the trigger and the count but none of the rows or their Abaikan buttons. Static — no
 * database, no DOM.
 */

const warnings = [
  { id: "a", message: "Sesi Luring di SMA 1 melewati tenggat" },
  { id: "b", message: "Persiapan Program jatuh tempo" },
];

describe("DashboardWarnings", () => {
  it("renders the Peringatan (N) trigger collapsed, with its rows hidden", () => {
    const html = renderToStaticMarkup(<DashboardWarnings warnings={warnings} />);
    // React separates the literal text from the interpolated count with `<!-- -->` markers.
    expect(html).toMatch(/Peringatan \((<!-- -->)?2(<!-- -->)?\)/);
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('aria-expanded="true"');
    expect(html).not.toContain(warnings[0].message);
    expect(html).not.toContain("Abaikan");
  });

  it("renders no active card when nothing is active", () => {
    const html = renderToStaticMarkup(<DashboardWarnings warnings={[]} />);
    expect(html).not.toContain("Peringatan (");
  });
});
