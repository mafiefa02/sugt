import { shortenKabupaten } from "-/lib/format-destination";
import { describe, expect, it } from "vitest";

/**
 * A Perjadin's `destination` is a write-once snapshot (`#105`) read by both the UI and the CSV
 * export. `shortenKabupaten` is the read-side transform that shortens "Kabupaten" to "Kab." on
 * screen only — the stored string and the export keep the full word. It is a pure seam so the
 * abbreviation lives in one implementation rather than five inline replaces.
 */
describe("shortenKabupaten", () => {
  it("abbreviates every 'Kabupaten ' in a Kabupaten-only destination", () => {
    expect(shortenKabupaten("Kelompok 12: Kabupaten Sleman dan Kabupaten Magelang")).toBe(
      "Kelompok 12: Kab. Sleman dan Kab. Magelang",
    );
  });

  it("leaves a Kota-only destination untouched", () => {
    expect(shortenKabupaten("Kelompok 3: Kota Yogyakarta dan Kota Magelang")).toBe(
      "Kelompok 3: Kota Yogyakarta dan Kota Magelang",
    );
  });

  it("abbreviates only the Kabupaten in a mixed destination", () => {
    expect(shortenKabupaten("Kelompok 7: Kabupaten Sleman dan Kota Yogyakarta")).toBe(
      "Kelompok 7: Kab. Sleman dan Kota Yogyakarta",
    );
  });

  it("leaves the 'Kelompok NN:' prefix intact", () => {
    expect(shortenKabupaten("Kelompok 12: Kabupaten Sleman")).toBe("Kelompok 12: Kab. Sleman");
  });
});
