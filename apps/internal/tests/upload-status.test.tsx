import { holdOpenWhile, UploadStatus, uploadStatusText } from "-/components/upload-status";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * **The upload status** (#420): what a Drive upload says while it runs, and the guard that keeps its
 * popup open meanwhile. Pure and static — no database, no Drive.
 */

const HINT = "Jangan tutup halaman ini sampai selesai.";

describe("uploadStatusText", () => {
  it("names Google Drive for one file, with no count", () => {
    expect(uploadStatusText({ phase: "uploading", done: 0, total: 1 })).toEqual({
      title: "Mengunggah ke Google Drive…",
      hint: HINT,
    });
  });

  it.each([
    [0, 3, "Mengunggah 1 dari 3 berkas ke Google Drive…"],
    [1, 3, "Mengunggah 2 dari 3 berkas ke Google Drive…"],
    [2, 3, "Mengunggah 3 dari 3 berkas ke Google Drive…"],
    // Every file finished but the phase not yet moved on: the count stops at the last file.
    [3, 3, "Mengunggah 3 dari 3 berkas ke Google Drive…"],
  ])("counts %i finished of %i as the file after them", (done, total, title) => {
    expect(uploadStatusText({ phase: "uploading", done, total }).title).toBe(title);
  });

  it("says Menyimpan… once the bytes are in", () => {
    expect(uploadStatusText({ phase: "saving" })).toEqual({ title: "Menyimpan…", hint: HINT });
  });
});

describe("UploadStatus", () => {
  it("renders a spinner, the headline and the hint as a live status, with no progress bar", () => {
    const html = renderToStaticMarkup(
      <UploadStatus progress={{ phase: "uploading", done: 1, total: 2 }} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("animate-spin");
    expect(html).toContain("Mengunggah 2 dari 2 berkas ke Google Drive…");
    expect(html).toContain(HINT);
    expect(html).not.toContain("progressbar");
    expect(html).not.toContain("%");
  });

  it("renders the saving phase", () => {
    const html = renderToStaticMarkup(<UploadStatus progress={{ phase: "saving" }} />);
    expect(html).toContain("Menyimpan…");
    expect(html).not.toContain("Mengunggah");
  });
});

describe("holdOpenWhile", () => {
  it("ignores a close while busy", () => {
    const onOpenChange = vi.fn();
    holdOpenWhile(true, onOpenChange)(false);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("passes a close through once idle, and an open either way", () => {
    const onOpenChange = vi.fn();
    holdOpenWhile(false, onOpenChange)(false);
    holdOpenWhile(true, onOpenChange)(true);
    expect(onOpenChange.mock.calls).toEqual([[false], [true]]);
  });
});
