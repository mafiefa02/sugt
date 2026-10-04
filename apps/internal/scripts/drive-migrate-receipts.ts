/**
 * **`pnpm --filter @sugt/internal drive:migrate-receipts`** — move every legacy receipt from the
 * Supabase `receipts` bucket into the company Google Drive (#377, ADR-0040). A person runs it, from a
 * laptop, during the cutover (#378); this file only parses flags and wires the real outside world to
 * `migrateLegacyReceipts` / `verifyMigration`, where the logic and its tests live.
 *
 * **Why locally, not as a route:** a Vercel function would time out on a backlog, and the run needs
 * the service-role key and `DRIVE_TOKEN_KEY` together. It runs outside turbo, like `db:*`, so it needs
 * no `turbo.json` entry.
 *
 * **It reads only the shell's environment — no `.env` file is loaded.** Export the target's
 * `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DRIVE_TOKEN_KEY`,
 * `GOOGLE_DRIVE_CLIENT_ID` and `GOOGLE_DRIVE_CLIENT_SECRET` first. A dev value silently filling in for
 * a production one would be the worst mistake available here, so it is made impossible, and the run
 * opens by printing which database and which Supabase project it is pointed at.
 *
 *     --as <email>              the Administrator running it (required)
 *     --dry-run                 list what would move, what is skipped and why; write nothing anywhere
 *     --verify                  check the finished state; exits 1 on any problem
 *     --replace <id>=<file>     a converted file for a receipt the script could not take (repeatable)
 *     --report <file>           the mapping report (default: one per database host)
 */
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { driveAccessToken } from "-/lib/drive/access-token";
import { readyFolders } from "-/lib/drive/fixed-folders";
import { type DriveClient, openDrive } from "-/lib/drive/google";
import { migrateLegacyReceipts, verifyMigration } from "-/lib/drive/migrate-receipts";
import { requireEnv } from "-/lib/env";
import { findActivePersonByEmail } from "-/lib/invite-list";
import { driveCredentials, hasGrant } from "@sugt/db/queries";
import { createClient } from "@supabase/supabase-js";

import { reencodeImage } from "./reencode-image";

const REPORT_HEADER = "evidence_id,storage_path,drive_file_id\n";

/**
 * A dry run must not touch Drive — nor refresh the token, which writes `last_used_at` and, on a bad
 * token, marks the connection broken. This stands in for the client so a slip is loud.
 */
const NO_DRIVE = new Proxy({} as DriveClient, {
  get: () => () => {
    throw new Error("A dry run never calls Google Drive.");
  },
});

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      as: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      verify: { type: "boolean", default: false },
      replace: { type: "string", multiple: true, default: [] },
      report: { type: "string" },
    },
  });

  const databaseHost = new URL(requireEnv("DATABASE_URL")).hostname;
  const supabaseHost = new URL(requireEnv("SUPABASE_URL")).hostname;
  const reportPath = values.report ?? `receipt-migration-report.${databaseHost}.csv`;
  console.log(`Database: ${databaseHost}`);
  console.log(`Supabase: ${supabaseHost}`);
  console.log(`Report:   ${reportPath}`);

  if (!values.as) {
    console.error("Name the Administrator running this: --as <email>.");
    return 2;
  }
  const person = await findActivePersonByEmail(values.as);
  if (!person || !hasGrant(person, "Administrator")) {
    console.error(`${values.as} is not an active Administrator.`);
    return 2;
  }

  // Refuse to start unless the connection is connected and the fixed folders resolve. A dry run
  // checks the stored row only; the others refresh the token, which they need to reach Drive.
  let drive = NO_DRIVE;
  let folders;
  if (values["dry-run"]) {
    const credentials = await driveCredentials(person);
    folders = credentials?.status === "connected" ? readyFolders(credentials) : null;
    if (!folders) {
      console.error(
        "Google Drive is not connected, or its folders are unresolved. Fix it on /pengaturan.",
      );
      return 1;
    }
  } else {
    const access = await driveAccessToken(person);
    if (access.outcome !== "ok") {
      console.error(`Google Drive is not usable (${access.outcome}). Fix it on /pengaturan first.`);
      return 1;
    }
    drive = openDrive(access.accessToken);
    folders = access.folders;
  }

  const bucket = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from("receipts");

  if (values.verify) {
    const problems = await verifyMigration(
      { person, drive },
      { keys: await bucketKeys(bucket), reportedKeys: await reportedKeys(reportPath) },
    );
    for (const problem of problems) console.log(JSON.stringify(problem));
    console.log(
      problems.length === 0
        ? "PASS — the migration is complete, and every object in the bucket is in the report."
        : `FAIL — ${problems.length} problem(s).`,
    );
    return problems.length === 0 ? 0 : 1;
  }

  const replacements = new Map<string, Uint8Array>();
  for (const pair of values.replace) {
    const at = pair.indexOf("=");
    if (at < 1) {
      console.error(`--replace takes <evidenceId>=<file>, not "${pair}".`);
      return 2;
    }
    replacements.set(pair.slice(0, at), new Uint8Array(await readFile(pair.slice(at + 1))));
  }

  // The header goes in once, before anything is migrated: a report is only ever appended to.
  if (!values["dry-run"] && (await readFile(reportPath, "utf8").catch(() => "")) === "") {
    await writeFile(reportPath, REPORT_HEADER);
  }

  const report = await migrateLegacyReceipts(
    {
      person,
      drive,
      folders,
      async download(storagePath) {
        const { data, error } = await bucket.download(storagePath);
        if (!error) return new Uint8Array(await data.arrayBuffer());
        // Only "not there" is a missing object; anything else — a 5xx, a 429, the network — is an
        // outage, and saying "not in the bucket" about it would be a lie.
        const notFound =
          ("status" in error && (error.status === 404 || error.status === 400)) ||
          /not.?found/i.test(error.message);
        if (notFound) return null;
        throw error;
      },
      reencodeImage,
      async appendReport({ evidenceId, storagePath, driveFileId }) {
        await appendFile(reportPath, `${evidenceId},${storagePath},${driveFileId}\n`);
      },
    },
    { dryRun: values["dry-run"], replacements },
  );

  const verb = values["dry-run"] ? "Would migrate" : "Migrated";
  for (const moved of report.migrated) {
    console.log(`${verb} ${moved.evidenceId} as ${moved.contentType}, ${moved.byteSize} bytes`);
  }
  for (const skip of report.skipped) {
    console.log(`Skipped ${skip.evidenceId} (${skip.storagePath}): ${skip.reason}`);
  }
  for (const failed of report.failed) {
    console.log(
      `Drive failed on ${failed.evidenceId} (${failed.storagePath}) — run again to retry it`,
    );
  }
  for (const pending of report.unsynced) {
    console.log(`Not yet in place ${pending.evidenceId}: ${JSON.stringify(pending.reason)}`);
  }
  const byReason = Object.entries(Object.groupBy(report.skipped, (skip) => skip.reason)).map(
    ([reason, skips]) => `${skips?.length ?? 0} ${reason}`,
  );
  console.log(
    `${verb} ${report.migrated.length}; skipped ${report.skipped.length}` +
      (byReason.length > 0 ? ` (${byReason.join(", ")})` : "") +
      `; Drive failed ${report.failed.length}; not yet in place ${report.unsynced.length}.`,
  );
  if (report.skipped.some((skip) => skip.reason !== "not-in-bucket")) {
    console.log(
      "Convert each one the script could not take and run again with --replace <evidenceId>=<file>.",
    );
  }
  return 0;
}

/** Every object key in the bucket. Its keys are bare UUIDs at the top level, so one paged listing has them all. */
async function bucketKeys(bucket: ReturnType<ReturnType<typeof createClient>["storage"]["from"]>) {
  const keys: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await bucket.list("", { limit: 1000, offset });
    if (error) throw error;
    keys.push(...data.filter((entry) => entry.id !== null).map((entry) => entry.name));
    if (data.length < 1000) return keys;
  }
}

/** The `storage_path` column of the report, or `null` when there is no report to check against. */
async function reportedKeys(path: string): Promise<string[] | null> {
  const text = await readFile(path, "utf8").catch(() => null);
  if (text === null) return null;
  return text
    .split("\n")
    .slice(1)
    .filter((line) => line.trim() !== "")
    .map((line) => line.split(",")[1]!);
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
