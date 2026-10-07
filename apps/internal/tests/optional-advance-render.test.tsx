import { MoneyFigure } from "-/components/money-figure";
import { TripMoney } from "-/components/my-perjadin-section";
import { EditAdvance } from "-/components/perjadin-advance";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * **What the money surfaces show while Uang Perjalanan is not filled in yet** (#437), rendered to
 * static markup with no database. The Laporan and the `/perjadin/[id]` strip both render their
 * figures through `MoneyFigure`; the `/pendamping` card renders `TripMoney`. Unset must never read as
 * "Rp 0", "NaN", "null" or a negative Sisa. Only the router is stubbed, because `EditAdvance` imports
 * a Server Action module that reaches it.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));

/** The text a reader sees, tags stripped. */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("the strip and the Laporan's figures", () => {
  it("read Belum diisi for Diterima and — for Sisa while the Advance is unset", () => {
    const html = renderToStaticMarkup(
      <dl>
        <MoneyFigure
          label="Diterima"
          amountIdr={null}
          unset="Belum diisi"
        />
        <MoneyFigure
          label="Terpakai"
          amountIdr={250_000}
        />
        <MoneyFigure
          label="Sisa"
          amountIdr={null}
        />
      </dl>,
    );

    expect(text(html)).toBe("Diterima Belum diisi Terpakai Rp250.000 Sisa —");
    expect(html).not.toMatch(/NaN|null|-Rp/);
  });

  it("read the amount once it is set, zero included", () => {
    expect(
      text(
        renderToStaticMarkup(
          <MoneyFigure
            label="Diterima"
            amountIdr={0}
            unset="Belum diisi"
          />,
        ),
      ),
    ).toBe("Diterima Rp0");
  });
});

describe("the /pendamping card's Uang Perjalanan", () => {
  it("reads belum diisi, with Terpakai but no Tersisa and no bar, while the Advance is unset", () => {
    const html = renderToStaticMarkup(
      <TripMoney
        advanceIdr={null}
        drawnDownIdr={150_000}
      />,
    );

    expect(text(html)).toBe("Uang Perjalanan belum diisi Terpakai Rp150.000");
    expect(html).not.toContain("Tersisa");
    expect(html).not.toContain('data-slot="progress"');
    expect(html).not.toMatch(/NaN|null|-Rp/);
  });

  it("shows Tersisa and the bar once the Advance is set", () => {
    const html = renderToStaticMarkup(
      <TripMoney
        advanceIdr={1_000_000}
        drawnDownIdr={250_000}
      />,
    );

    expect(text(html)).toContain("Tersisa Rp750.000");
    expect(html).toContain('data-slot="progress"');
  });
});

describe("the Advance's edit trigger", () => {
  it("reads Isi Uang Perjalanan while unset, and Ubah once set", () => {
    const unset = renderToStaticMarkup(
      <EditAdvance
        perjadinId="p"
        advanceIdr={null}
        canEdit
      />,
    );
    const set = renderToStaticMarkup(
      <EditAdvance
        perjadinId="p"
        advanceIdr={5_000_000}
        canEdit
      />,
    );

    expect(text(unset)).toBe("Isi Uang Perjalanan");
    expect(text(set)).toBe("Ubah Uang Perjalanan");
  });
});
