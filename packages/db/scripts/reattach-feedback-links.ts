/**
 * `pnpm --filter @sugt/db db:reattach-links <file.csv> --operator <email> [--apply]`
 *
 * Reattaches feedback links an earlier reissue overwrote (#453, ADR-0049): each
 * `link,target[,kind]` line becomes an additional link on its Session or Perjadin. **A dry run unless `--apply` is
 * given**, and either way it prints a line-by-line report and a summary. The rules are in
 * `src/feedback-link-recovery.ts`.
 *
 * Runs against `DIRECT_URL`, on the footing `db:seed` is on: a package script outside turbo, with
 * the variable set in the shell rather than read from a file, so the database it writes is the one the
 * operator named. The report's first line names that database's host. It runs on Node's own type
 * stripping (Node 22.18 or later), which is why the import below carries its `.ts` extension.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import postgres from "postgres";

import {
  formatRecoveryReport,
  parseRecoveryCsv,
  reattachFeedbackLinks,
} from "../src/feedback-link-recovery.ts";

const USAGE =
  "Pakai: pnpm --filter @sugt/db db:reattach-links <berkas.csv> --operator <email> [--apply]";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const operatorAt = args.indexOf("--operator");
const operatorEmail = operatorAt === -1 ? undefined : args[operatorAt + 1];
const file = args.find((arg, i) => !arg.startsWith("--") && i !== operatorAt + 1);

if (!file || !operatorEmail) fail(USAGE);

const url = process.env.DIRECT_URL;
if (!url) fail("DIRECT_URL belum diatur. Atur di shell, seperti untuk db:seed.");

// pnpm runs a package script from the package's own directory; `INIT_CWD` is where the operator
// typed the command, so a relative path means what they meant by it.
const path = resolve(process.env.INIT_CWD ?? process.cwd(), file);
const lines = parseRecoveryCsv(readFileSync(path, "utf8"));

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  console.log(`Basis data: ${new URL(url).host}${new URL(url).pathname}`);
  const report = await reattachFeedbackLinks(sql, { lines, operatorEmail, apply });
  console.log(formatRecoveryReport(report));
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await sql.end();
}
