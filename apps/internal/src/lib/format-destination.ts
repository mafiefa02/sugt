/**
 * Shorten "Kabupaten" to "Kab." in a Perjadin `destination` line — a **render-time only**
 * transform.
 *
 * `destination` is a derived, write-once snapshot (`#105`): `` `${subCluster.name}: ${list}` ``.
 * A Sub-Cluster spanning several regencies reads long on screen — `Kelompok 12: Kabupaten
 * Sleman dan Kabupaten Magelang`. Because the same stored string feeds the CSV export and the
 * Surat Tugas, the abbreviation cannot happen at derivation without leaking "Kab." into those
 * official outputs. So it is a read-side transform, applied only where the line is shown.
 *
 * Case-sensitive, whole word, every occurrence; "Kota" and everything else are left verbatim.
 */
export function shortenKabupaten(s: string): string {
  return s.replace(/\bKabupaten /g, "Kab. ");
}
