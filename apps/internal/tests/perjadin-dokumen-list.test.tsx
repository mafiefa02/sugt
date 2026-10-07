import { PerjadinDokumenList } from "-/components/perjadin-dokumen-list";
import type { DocumentSchool, PerjadinDocumentRow } from "@sugt/db/queries";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * **The Dokumen list's SPPD section** (#441): each SPPD under its own heading by School and with no
 * date, and the **SPPD: x/y sekolah** summary counting the trip's Schools, so a missing one shows.
 */

vi.mock("-/app/(app)/perjadin/[id]/dokumen/actions", () => ({ deleteDocumentAction: vi.fn() }));

const bontang: DocumentSchool = {
  id: "s-1",
  name: "SMAN 1 Bontang",
  timeZone: "WITA",
  hasSppd: true,
};
const samarinda: DocumentSchool = {
  id: "s-2",
  name: "SMAN 2 Samarinda",
  timeZone: "WITA",
  hasSppd: false,
};

const sppdRow: PerjadinDocumentRow = {
  id: "1a2b3c4d-0000-0000-0000-000000000000",
  kind: "SPPD",
  documentDate: null,
  schoolName: "SMAN 1 Bontang",
  participantType: null,
  startsAt: null,
  endsAt: null,
  timeZone: null,
  driveFileId: "file-1",
  unsynced: false,
};

describe("the SPPD section", () => {
  it("lists each SPPD by its School and counts the trip's Schools that have one", () => {
    const html = renderToStaticMarkup(
      <PerjadinDokumenList
        documents={[sppdRow]}
        schools={[bontang, samarinda]}
      />,
    );

    expect(html).toContain(">SPPD<");
    expect(html).toContain("SPPD: 1/2 sekolah");
    expect(html).toContain(">SMAN 1 Bontang<");
  });

  it("says Belum ada, and 0/y, while no School has one", () => {
    const html = renderToStaticMarkup(
      <PerjadinDokumenList
        documents={[]}
        schools={[{ ...bontang, hasSppd: false }]}
      />,
    );

    expect(html).toContain("SPPD: 0/1 sekolah");
    // One per kind: the three attendance kinds and SPPD.
    expect(html.match(/Belum ada/g)).toHaveLength(4);
  });
});
