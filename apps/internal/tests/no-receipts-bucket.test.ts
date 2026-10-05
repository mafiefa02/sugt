import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * **Nothing in the internal app reaches the Supabase `receipts` bucket** (#379, ADR-0040). Receipts
 * live in the company Google Drive; the bucket is deleted by hand once this is in production (#380),
 * so a line of code still naming it would fail only then, on a screen. Its client bundle and its
 * server code are both built from these sources, and so is the query layer it imports.
 *
 * Story photos stay in Supabase (`public-media`), so the check is on the bucket's name, not on
 * Supabase Storage as a whole.
 */

const SOURCES = [
  new URL("../src/", import.meta.url).pathname,
  new URL("../../../packages/db/src/", import.meta.url).pathname,
];

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(ts|tsx|mts)$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

describe("the receipts bucket", () => {
  it("is named by no source file as a string", async () => {
    const files = (await Promise.all(SOURCES.map(sourceFiles))).flat();
    expect(files.length).toBeGreaterThan(100);

    const naming = [];
    for (const file of files) {
      const text = await readFile(file, "utf8");
      if (/["'`]receipts["'`/]/.test(text)) naming.push(file);
    }
    expect(naming).toEqual([]);
  });

  it("leaves Story photos the only Storage bucket the app opens", async () => {
    const opened = [];
    for (const file of await sourceFiles(SOURCES[0]!)) {
      const text = await readFile(file, "utf8");
      if (/\.storage\s*\.from\(/.test(text)) opened.push(path.basename(file));
    }
    expect(opened).toEqual(["story-media.ts"]);
  });
});
