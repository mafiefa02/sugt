/**
 * **`pnpm --filter @sugt/internal drive:migrate-receipts`** — move every legacy receipt from the
 * Supabase `receipts` bucket into the company Google Drive (#377, ADR-0040). A person runs it, from a
 * laptop, during the cutover (#378); this file only parses flags and wires the real outside world to
 * `migrateLegacyReceipts` / `verifyMigration`, where the logic and its tests live.
 *
 * **Why locally, not as a route:** a Vercel function would time out on a backlog, and the run needs
 * the service-role key and `DRIVE_TOKEN_KEY` together. It runs outside turbo, like `db:*`, so it needs
 * no `turbo.json` entry. It reads `apps/internal/.env` when present (`--env-file-if-exists`):
 * `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DRIVE_TOKEN_KEY`,
 * `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`.
 *
 *     --as <email>              the Administrator running it (required)
 *     --dry-run                 list what would move, what is skipped and why; write nothing
 *     --verify                  check the finished state; exits 1 on any problem
 *     --replace <id>=<file>     a converted file for a receipt the sniff refused (repeatable)
 *     --report <file>           the mapping report (default ./receipt-migration-report.csv)
 */
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { driveAccessToken } from "-/lib/drive/access-token";
import { openDrive } from "-/lib/drive/google";
import { migrateLegacyReceipts, verifyMigration } from "-/lib/drive/migrate-receipts";
import { requireEnv } from "-/lib/env";
import { findActivePersonByEmail } from "-/lib/invite-list";
import { hasGrant } from "@sugt/db/queries";
import { createClient } from "@supabase/supabase-js";

import { reencodeImage } from "./reencode-image";

const REPORT_HEADER = "evidence_id,storage_path,drive_file_id\n";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      as: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      verify: { type: "boolean", default: false },
      replace: { type: "string", multiple: true, default: [] },
      report: { type: "string", default: "receipt-migration-report.csv" },
    },
  });

  if (!values.as) {
    console.error("Name the Administrator running this: --as <email>.");
    return 2;
  }
  const person = await findActivePersonByEmail(values.as);
  if (!person || !hasGrant(person, "Administrator")) {
    console.error(`${values.as} is not an active Administrator.`);
    return 2;
  }

  // Refuse to start unless the connection is connected and the fixed folders resolve.
  const access = await driveAccessToken(person);
  if (access.outcome !== "ok") {
    console.error(`Google Drive is not usable (${access.outcome}). Fix it on /pengaturan first.`);
    return 1;
  }
  const drive = openDrive(access.accessToken);
  const bucket = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from("receipts");

  if (values.verify) {
    const problems = await verifyMigration(
      { person, drive },
      {
        bucketObjects: await countBucketObjects(bucket),
        reportLines: await countReportLines(values.report),
      },
    );
    for (const problem of problems) console.log(JSON.stringify(problem));
    console.log(
      problems.length === 0
        ? "PASS — the migration is complete."
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

  const report = await migrateLegacyReceipts(
    {
      person,
      drive,
      folders: access.folders,
      async download(storagePath) {
        const { data, error } = await bucket.download(storagePath);
        return error || !data ? null : new Uint8Array(await data.arrayBuffer());
      },
      reencodeImage,
      async appendReport({ evidenceId, storagePath, driveFileId }) {
        if ((await countReportLines(values.report)) === undefined) {
          await writeFile(values.report, REPORT_HEADER);
        }
        await appendFile(values.report, `${evidenceId},${storagePath},${driveFileId}\n`);
      },
    },
    { dryRun: values["dry-run"], replacements },
  );

  const verb = values["dry-run"] ? "Would migrate" : "Migrated";
  console.log(`${verb} ${report.migrated.length} receipt(s).`);
  for (const skip of report.skipped) {
    console.log(`Skipped ${skip.evidenceId} (${skip.storagePath}): ${skip.reason}`);
  }
  for (const pending of report.unsynced) {
    console.log(`Not yet in place ${pending.evidenceId}: ${JSON.stringify(pending.reason)}`);
  }
  if (
    report.skipped.some(
      (skip) => skip.reason === "unsupported-type" || skip.reason === "unreadable",
    )
  ) {
    console.log("Convert each unsupported file and run again with --replace <evidenceId>=<file>.");
  }
  return 0;
}

/** Objects in the bucket. Its keys are bare UUIDs at the top level, so one paged listing counts them. */
async function countBucketObjects(
  bucket: ReturnType<ReturnType<typeof createClient>["storage"]["from"]>,
) {
  let total = 0;
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await bucket.list("", { limit: 1000, offset });
    if (error) throw error;
    total += data.filter((entry) => entry.id !== null).length;
    if (data.length < 1000) return total;
  }
}

/** Lines in the report, header excluded — or `undefined` when there is no report yet. */
async function countReportLines(path: string): Promise<number | undefined> {
  const text = await readFile(path, "utf8").catch(() => undefined);
  if (text === undefined) return undefined;
  return text.split("\n").filter((line) => line.trim() !== "").length - 1;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
