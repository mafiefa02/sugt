import sharp from "sharp";

/**
 * **A legacy photograph re-encoded the way the browser does it** (ADR-0040, #377): JPEG, long edge at
 * most 2400 px, quality 82, EXIF orientation applied — and **EXIF and GPS stripped**, since sharp
 * writes no metadata unless asked, and these receipts are about to be link-public. A transparent PNG
 * is flattened onto white, as the browser's canvas does. Only the migration script imports this, so
 * `sharp` never reaches the app.
 */
export async function reencodeImage(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp(bytes)
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82 })
      .toBuffer(),
  );
}
