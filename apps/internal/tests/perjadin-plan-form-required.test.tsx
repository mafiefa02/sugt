import { PerjadinPlanForm } from "-/components/perjadin-plan-form";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * **Which fields on Rencanakan Perjadin say they are required** (#354). The form is rendered to static
 * markup, before any Sub-Cluster is picked — so the per-Session rows are not on screen yet and
 * Tanggal Sesi / Jam Mulai are not covered here. The router and the Server Action are stubbed:
 * nothing is submitted, and what is read is only labels and attributes.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));
vi.mock("-/app/(app)/perjadin/baru/actions", () => ({ planPerjadinAction: vi.fn() }));

function render() {
  return renderToStaticMarkup(
    <PerjadinPlanForm
      subClusters={[]}
      staff={[{ id: "s1", fullName: "Staf Satu" }]}
      pimpinan={[{ id: "p1", fullName: "Pimpinan Satu" }]}
    />,
  );
}

const MARK = '<span aria-hidden="true"';

/** Every `<label>` on the form, as its visible text and whether it carries the required marker. */
function labels(html: string) {
  return [...html.matchAll(/<label[^>]*>(.*?)<\/label>/g)].map(([, inner = ""]) => ({
    text: inner
      .replace(/<[^>]+>/g, "")
      .replace("*", "")
      .trim(),
    required: inner.includes(MARK),
  }));
}

describe("PerjadinPlanForm's required markers", () => {
  it("marks exactly the fields the submit guard requires", () => {
    const required = labels(render())
      .filter((label) => label.required)
      .map((label) => label.text);

    expect(required).toEqual([
      "Kelompok Sekolah",
      "PIC",
      "Uang Perjalanan (Rp)",
      "Tanggal",
      "Jam",
      "Moda",
      "Tanggal",
      "Jam",
      "Moda",
    ]);
  });

  it("leaves Pendamping tambahan and Pimpinan unmarked, and says (opsional) nowhere", () => {
    const html = render();
    const all = labels(html);

    expect(all.find((label) => label.text === "Pendamping tambahan")?.required).toBe(false);
    expect(all.find((label) => label.text === "Pimpinan")?.required).toBe(false);
    expect(html).not.toContain("opsional");
  });

  it("shows the legend once, and flags each required control for a screen reader", () => {
    const html = render();

    expect(html.match(/wajib diisi/g)).toHaveLength(1);
    expect(html.match(/aria-required="true"/g)).toHaveLength(9);
  });
});
