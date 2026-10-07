import { AnggotaRoster } from "-/components/my-perjadin-section";
import type { MyPerjadinPengajar, MyPerjadinTrip } from "@sugt/db/queries";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * **The `/pendamping` card's Narasumber block, folded by School** (#447), rendered closed — as every
 * page load starts — with no database. The query test owns who lands under which School; this owns
 * the words, the order on screen, and that each toggle is a real button wired to its panel.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));

/** The text a reader sees, tags stripped — hidden panels included, so callers strip those first. */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The markup with every closed panel taken out: what a sighted reader sees. */
const visible = (html: string) => html.replace(/<div[^>]*hidden=""[^>]*>[\s\S]*?<\/div>/g, "");

const people = (...names: string[]): MyPerjadinPengajar[] =>
  names.map((name) => ({ id: `t-${name}`, name }));

function roster(
  pengajar: MyPerjadinPengajar[],
  narasumber: MyPerjadinTrip["anggota"]["narasumber"],
): string {
  return renderToStaticMarkup(
    <AnggotaRoster
      anggota={{
        staff: [{ personId: "p-1", fullName: "Rina", isPic: true }],
        pengajar,
        narasumber,
        pimpinan: [{ personId: "p-2", name: "Pak Joko" }],
        anggotaTotal: pengajar.length + 2,
      }}
    />,
  );
}

// The ticket's Perjadin A, variant: 11 Narasumber, SMAN 3 with no team, Pak Kurnia unassigned.
const sman1 = people("Bu Ani", "Bu Citra", "Bu Eka", "Pak Budi", "Pak Dedi", "Pak Fajar");
const sman2 = people("Bu Ani", "Bu Hana", "Bu Joko", "Pak Fajar", "Pak Gilang", "Pak Indra");
const kurnia = people("Pak Kurnia");
const all = [...new Map([...sman1, ...sman2, ...kurnia].map((p) => [p.id, p])).values()];
const variant = roster(all, {
  bySchool: [
    { schoolId: "s-1", name: "SMAN 1 Bontang", pengajar: sman1 },
    { schoolId: "s-2", name: "SMAN 2 Bontang", pengajar: sman2 },
    { schoolId: "s-3", name: "SMAN 3 Bontang", pengajar: [] },
  ],
  unassigned: kurnia,
});

describe("the Narasumber block, closed", () => {
  it("reads as the ticket's variant: the count once, a toggle per School, belum ditugaskan last", () => {
    expect(text(visible(variant))).toBe(
      [
        "Pendamping Rina",
        "Narasumber (11)",
        "Tampilkan Narasumber SMAN 1 Bontang (6)",
        "Tampilkan Narasumber SMAN 2 Bontang (6)",
        "Narasumber SMAN 3 Bontang: belum ditugaskan",
        "Tampilkan Narasumber belum ditugaskan (1)",
        "Pimpinan Pak Joko",
      ].join(" "),
    );
  });

  it("makes each toggle a button with aria-expanded, controlling its hidden panel of names", () => {
    const buttons = [...variant.matchAll(/<button[^>]*>/g)].map(([tag]) => tag);
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button).toContain('type="button"');
      expect(button).toContain('aria-expanded="false"');
      const controls = /aria-controls="([^"]+)"/.exec(button)?.[1];
      expect(controls).toBeTruthy();
      const panel = new RegExp(`<div[^>]*id="${controls}"[^>]*>`).exec(variant)?.[0];
      expect(panel).toContain('hidden=""');
    }
  });

  it("puts the names one per line, A–Z as given, in each School's own panel", () => {
    const panels = [...variant.matchAll(/<div[^>]*hidden=""[^>]*>([\s\S]*?)<\/div>/g)].map(
      ([, body]) => [...body!.matchAll(/<li[^>]*>([^<]*)<\/li>/g)].map(([, name]) => name),
    );
    expect(panels).toEqual([
      ["Bu Ani", "Bu Citra", "Bu Eka", "Pak Budi", "Pak Dedi", "Pak Fajar"],
      ["Bu Ani", "Bu Hana", "Bu Joko", "Pak Fajar", "Pak Gilang", "Pak Indra"],
      ["Pak Kurnia"],
    ]);
  });

  it("says Narasumber (0) and nothing else for a trip with none", () => {
    const html = roster([], {
      bySchool: [{ schoolId: "s-1", name: "SMAN 1 Bontang", pengajar: [] }],
      unassigned: [],
    });
    expect(text(html)).toBe("Pendamping Rina Narasumber (0) Pimpinan Pak Joko");
  });

  it("shows a freshly planned trip's six names under one belum ditugaskan toggle", () => {
    const six = people("Bu Ani", "Bu Citra", "Bu Eka", "Pak Budi", "Pak Dedi", "Pak Fajar");
    const html = roster(six, {
      bySchool: [
        { schoolId: "s-1", name: "SMAN 1 Bontang", pengajar: [] },
        { schoolId: "s-2", name: "SMAN 2 Bontang", pengajar: [] },
      ],
      unassigned: six,
    });
    expect(text(visible(html))).toBe(
      [
        "Pendamping Rina",
        "Narasumber (6)",
        "Narasumber SMAN 1 Bontang: belum ditugaskan",
        "Narasumber SMAN 2 Bontang: belum ditugaskan",
        "Tampilkan Narasumber belum ditugaskan (6)",
        "Pimpinan Pak Joko",
      ].join(" "),
    );
  });
});
