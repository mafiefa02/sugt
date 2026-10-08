import type { Sql } from "postgres";

/**
 * **Reattaching feedback links an earlier reissue overwrote** (#453, ADR-0049) — the logic behind
 * `db:reattach-links` (`scripts/reattach-feedback-links.ts`).
 *
 * Until ADR-0049, pressing "Tampilkan QR" again replaced a Session's or a Perjadin's link, so QRs
 * printed and links shortened before that press stopped resolving. Their strings are gone from the
 * database and have to be collected from outside — bit.ly dashboards, printed QRs, backups (#454).
 * This attaches each one back to its target as **an additional link**, beside the one the dialog
 * shows: the table allows several per Session or Perjadin, and issuing keeps returning the
 * original, because a reattached row's `issued_at` is the moment it was reattached.
 *
 * **It never updates or deletes a row, and never moves a token.** Every line is checked and written
 * on its own, so one bad line is reported and the rest carry on. A token already on the same target
 * is "sudah aktif", which is what makes a second `--apply` of the same file a no-op.
 *
 * Raw SQL on a `postgres` client it is handed, and no relative import, on purpose: the script runs
 * under Node's own type stripping, outside turbo and Next, so this file imports nothing Node could
 * not resolve without a bundler. The tests hand it the test database's client.
 */

/** Which table a link belongs to: `/f/{token}` is a Session's, `/ep/{token}` a Perjadin's. */
export type LinkKind = "session" | "perjadin";

/** One `link,target[,kind]` line of the input file, as typed. */
export type RecoveryLine = {
  /** 1-based, counting every line of the file, so the report points at the line the operator sees. */
  line: number;
  link: string;
  target: string;
  /** Required only for a bare token. `session` or `f`, `perjadin` or `ep`. */
  kind: string | null;
};

export type RecoveryOutcome =
  /** Written, with `--apply`. */
  | "attached"
  /** What `--apply` would write. Nothing was. */
  | "would-attach"
  /** The token is already on this target — still active, or a line repeated. No change. */
  | "already-active"
  /** Not written, for `reason`. */
  | "refused";

export type RecoveryResult = RecoveryLine & {
  outcome: RecoveryOutcome;
  /** Why it was refused, in the words the report prints. */
  reason?: string;
  /** Attached, but worth a second look — a cancelled Session's link still shows "tidak berlaku". */
  flag?: string;
};

export type RecoveryReport = {
  operator: { id: string; fullName: string; email: string };
  apply: boolean;
  results: RecoveryResult[];
};

/** A token is a `gen_random_uuid()` string — the only shape the app has ever issued. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KIND_WORDS: Record<string, LinkKind> = {
  session: "session",
  sesi: "session",
  f: "session",
  perjadin: "perjadin",
  ep: "perjadin",
};

const KIND_LABEL: Record<LinkKind, string> = { session: "Sesi", perjadin: "Perjadin" };
const KIND_PATH: Record<LinkKind, string> = { session: "/f/", perjadin: "/ep/" };

/**
 * Read the input file: one `link,target[,kind]` per line. Blank lines, `#` comments and a header
 * line (first field `link` or `tautan`) are skipped. Fields are trimmed, and surrounding double
 * quotes are dropped, so a spreadsheet's CSV export reads as typed.
 */
export function parseRecoveryCsv(text: string): RecoveryLine[] {
  const lines: RecoveryLine[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#")) return;
    const [link = "", target = "", kind = ""] = trimmed.split(",").map((field) =>
      field
        .trim()
        .replace(/^"(.*)"$/, "$1")
        .trim(),
    );
    if (/^(link|tautan)$/i.test(link)) return;
    lines.push({ line: index + 1, link, target, kind: kind === "" ? null : kind });
  });
  return lines;
}

type ParsedLink = { ok: true; kind: LinkKind; token: string } | { ok: false; reason: string };

/**
 * A link — a full URL whose path is `/f/{token}` or `/ep/{token}`, or a bare token with its kind
 * given — as the token and the table it belongs to. A token is lower-cased: `gen_random_uuid()`
 * never issued an upper-case one, so a shortener or a hand-typed copy that changed the case still
 * names the same link.
 */
export function parseLink(link: string, kindWord: string | null): ParsedLink {
  const given = kindWord === null ? null : KIND_WORDS[kindWord.toLowerCase()];
  if (given === undefined) {
    return { ok: false, reason: `jenis "${kindWord}" tidak dikenal (pakai session atau perjadin)` };
  }

  if (UUID.test(link)) {
    if (given === null) {
      return { ok: false, reason: "token tanpa URL perlu jenisnya (session atau perjadin)" };
    }
    return { ok: true, kind: given, token: link.toLowerCase() };
  }

  const path = urlPath(link);
  const match = path === null ? null : /^\/(f|ep)\/([^/]+)\/?$/.exec(path);
  const token = match ? safeDecode(match[2]!) : null;
  if (!match || token === null || !UUID.test(token)) {
    return { ok: false, reason: "bukan tautan /f/ atau /ep/ dan bukan token" };
  }
  const kind = KIND_WORDS[match[1]!]!;
  if (given !== null && given !== kind) {
    return { ok: false, reason: `tautan ${KIND_PATH[kind]} tetapi jenisnya ${given}` };
  }
  return { ok: true, kind, token: token.toLowerCase() };
}

function urlPath(link: string): string | null {
  for (const candidate of [link, `https://${link}`]) {
    try {
      return new URL(candidate).pathname;
    } catch {
      // Not a URL as written; a link copied without its scheme gets one more try.
    }
  }
  return null;
}

function safeDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * The Staff Person the reattached rows are recorded against (`issued_by_person_id`), by email. A
 * revoked or non-Staff Person is refused before any line is read: the script is an operator's act,
 * and the row should say which operator.
 */
export async function findOperator(sql: Sql, email: string): Promise<RecoveryReport["operator"]> {
  const [row] = await sql<{ id: string; full_name: string; email: string; role: string }[]>`
    select id, full_name, email, role from person where lower(email) = lower(${email}) and active
  `;
  if (!row) throw new Error(`Tidak ada Person aktif dengan email ${email}.`);
  if (row.role !== "Staff") {
    throw new Error(`${row.email} bukan Staff (${row.role}); operator harus Staff.`);
  }
  return { id: row.id, fullName: row.full_name, email: row.email };
}

type TokenOwner = { kind: LinkKind; target: string };

async function ownerOf(sql: Sql, token: string): Promise<TokenOwner | null> {
  // Both tables: a token is never moved, and never shared across the two kinds either.
  const [row] = await sql<{ kind: LinkKind; target: string }[]>`
    select 'session' as kind, session_id::text as target from session_feedback_token where token = ${token}
    union all
    select 'perjadin', perjadin_id::text from perjadin_feedback_token where token = ${token}
  `;
  return row ?? null;
}

type TargetState = { exists: false } | { exists: true; cancelled: boolean };

async function targetState(sql: Sql, kind: LinkKind, id: string): Promise<TargetState> {
  if (kind === "session") {
    const [row] = await sql<{ status: string }[]>`select status from session where id = ${id}`;
    return row ? { exists: true, cancelled: row.status === "cancelled" } : { exists: false };
  }
  const [row] = await sql`select 1 from perjadin where id = ${id}`;
  return row ? { exists: true, cancelled: false } : { exists: false };
}

async function insertLink(
  sql: Sql,
  kind: LinkKind,
  token: string,
  target: string,
  operatorId: string,
): Promise<boolean> {
  // `on conflict do nothing`: a token that lands between the check and here is left as it is and
  // re-read by the caller, never overwritten.
  const rows =
    kind === "session"
      ? await sql`
          insert into session_feedback_token (token, session_id, issued_by_person_id)
          values (${token}, ${target}, ${operatorId})
          on conflict (token) do nothing
          returning token
        `
      : await sql`
          insert into perjadin_feedback_token (token, perjadin_id, issued_by_person_id)
          values (${token}, ${target}, ${operatorId})
          on conflict (token) do nothing
          returning token
        `;
  return rows.length === 1;
}

function ownedElsewhere(owner: TokenOwner): string {
  return `token sudah milik ${KIND_LABEL[owner.kind]} ${owner.target}; token tidak pernah dipindah`;
}

/**
 * Check — and with `apply`, write — every line. Without `apply` it writes nothing and reports what
 * it would do; a line repeated within the file is "sudah aktif" in both modes, so a dry run reads
 * exactly as the real run will.
 */
export async function reattachFeedbackLinks(
  sql: Sql,
  input: { lines: RecoveryLine[]; operatorEmail: string; apply: boolean },
): Promise<RecoveryReport> {
  const operator = await findOperator(sql, input.operatorEmail);
  // What this run has attached or would attach, so a repeated line in a dry run is seen too.
  const planned = new Map<string, TokenOwner>();
  const results: RecoveryResult[] = [];

  for (const line of input.lines) {
    try {
      results.push(await reattachOne(sql, line, operator.id, input.apply, planned));
    } catch (error) {
      results.push({ ...line, outcome: "refused", reason: `galat: ${String(error)}` });
    }
  }

  return { operator, apply: input.apply, results };
}

async function reattachOne(
  sql: Sql,
  line: RecoveryLine,
  operatorId: string,
  apply: boolean,
  planned: Map<string, TokenOwner>,
): Promise<RecoveryResult> {
  const refuse = (reason: string): RecoveryResult => ({ ...line, outcome: "refused", reason });

  const parsed = parseLink(line.link, line.kind);
  if (!parsed.ok) return refuse(parsed.reason);
  const { kind, token } = parsed;

  // An id that is not UUID-shaped cannot name a row, and would fail the cast rather than miss.
  if (!UUID.test(line.target)) return refuse("target tidak ditemukan");
  const target = line.target.toLowerCase();

  const state = await targetState(sql, kind, target);
  if (!state.exists) {
    const other: LinkKind = kind === "session" ? "perjadin" : "session";
    if ((await targetState(sql, other, target)).exists) {
      return refuse(
        `tautan ${KIND_PATH[kind]} untuk ${KIND_LABEL[kind]}, tetapi target adalah ${KIND_LABEL[other]}`,
      );
    }
    return refuse("target tidak ditemukan");
  }

  const owner = (await ownerOf(sql, token)) ?? planned.get(token) ?? null;
  if (owner) {
    if (owner.kind === kind && owner.target === target)
      return { ...line, outcome: "already-active" };
    return refuse(ownedElsewhere(owner));
  }

  if (apply && !(await insertLink(sql, kind, token, target, operatorId))) {
    // Another writer took the token between the read and the insert. Report what is there now.
    const now = await ownerOf(sql, token);
    if (now && now.kind === kind && now.target === target)
      return { ...line, outcome: "already-active" };
    return refuse(now ? ownedElsewhere(now) : "token tidak dapat dilampirkan");
  }
  planned.set(token, { kind, target });

  return {
    ...line,
    outcome: apply ? "attached" : "would-attach",
    ...(state.cancelled
      ? { flag: 'Sesi ini dibatalkan: tautannya tetap menampilkan "tidak berlaku"' }
      : {}),
  };
}

const OUTCOME_LABEL: Record<RecoveryOutcome, string> = {
  attached: "dilampirkan",
  "would-attach": "akan dilampirkan",
  "already-active": "sudah aktif",
  refused: "ditolak",
};

/** The per-line report and the summary the script prints, in the order the lines were read. */
export function formatRecoveryReport(report: RecoveryReport): string {
  const out: string[] = [
    report.apply
      ? "Mode --apply: baris yang lolos ditulis."
      : "Uji coba (tanpa --apply): tidak ada yang ditulis.",
    `Operator: ${report.operator.fullName} <${report.operator.email}>`,
    "",
  ];
  for (const r of report.results) {
    let text = `baris ${r.line}: ${r.link} -> ${r.target}: ${OUTCOME_LABEL[r.outcome]}`;
    if (r.reason) text += ` (${r.reason})`;
    if (r.flag) text += ` [perhatian: ${r.flag}]`;
    out.push(text);
  }
  const count = (outcome: RecoveryOutcome) =>
    report.results.filter((r) => r.outcome === outcome).length;
  const flagged = report.results.filter((r) => r.flag).length;
  out.push(
    "",
    `Ringkasan: ${report.results.length} baris — ` +
      [
        `${count(report.apply ? "attached" : "would-attach")} ${OUTCOME_LABEL[report.apply ? "attached" : "would-attach"]}`,
        `${count("already-active")} sudah aktif`,
        `${count("refused")} ditolak`,
        ...(flagged > 0 ? [`${flagged} perlu perhatian`] : []),
      ].join(", ") +
      ".",
  );
  if (!report.apply) out.push("Jalankan lagi dengan --apply untuk menulis.");
  return out.join("\n");
}
