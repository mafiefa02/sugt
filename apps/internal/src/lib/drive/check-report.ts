import type {
  DocumentSweepFailure,
  DriveCheckReport,
  ExposableFolder,
  FolderCheck,
  SweepFailure,
} from "./check";

/**
 * **What Periksa koneksi says** (#375) — the report as sentences, kept apart from both the check
 * (server) and the card (client) so one test reads exactly what an Administrator reads. Types only
 * cross from `check.ts`; nothing server-only reaches the browser through here.
 */

const FOLDER_NAMES: Record<FolderCheck["folder"], string> = {
  root: "Folder utama",
  staging: "Folder _staging",
  "bukti-transaksi": "Folder Bukti Transaksi",
  "pelaksanaan-offline": "Folder Pelaksanaan Offline",
};

const FOLDER_STATES: Record<FolderCheck["state"], string> = {
  ok: "ada",
  trashed: "ada di Sampah Google Drive",
  missing: "tidak ditemukan",
};

const FAILURE_REASONS: Record<SweepFailure["reason"], string> = {
  "folder-trashed": "folder ada di Sampah Google Drive",
  "folder-missing": "folder tidak ditemukan",
  "drive-failed": "Google Drive gagal menjawab",
  "newer-receipts": "ada bukti baru yang masih diproses",
  "no-such-transaction": "transaksi sudah tidak ada",
};

const DOCUMENT_FAILURE_REASONS: Record<DocumentSweepFailure["reason"], string> = {
  "folder-trashed": "folder ada di Sampah Google Drive",
  "folder-missing": "folder tidak ditemukan",
  "file-trashed": "berkas ada di Sampah Google Drive",
  "file-missing": "berkas tidak ditemukan",
  "drive-failed": "Google Drive gagal menjawab",
  "no-such-document": "dokumen sudah tidak ada",
};

const DOKUMEN_LINES: Record<"ok" | "created", string> = {
  ok: "Folder Dokumen: ada.",
  created: "Folder Dokumen: dibuat.",
};

/** The prominent warning when a link-shared folder reaches the root or `_staging`. */
export function exposureWarning(folder: ExposableFolder): string {
  return `${FOLDER_NAMES[folder]} dapat dibuka siapa saja yang punya link — pindahkan keluar dari folder yang dibagikan.`;
}

export type DriveCheckSentences = {
  /** One line per finding, in the order the check ran. */
  lines: string[];
  /** Said prominently: a folder anyone with a link can open. */
  warnings: string[];
  /** Each line the sweep could not finish, and why. */
  failures: string[];
};

export function describeDriveCheck(report: DriveCheckReport): DriveCheckSentences {
  switch (report.token) {
    case "not-connected":
      return { lines: ["Google Drive belum terhubung."], warnings: [], failures: [] };
    case "broken":
      return {
        lines: ["Google menolak token — koneksi ditandai terputus. Hubungkan ulang."],
        warnings: [],
        failures: [],
      };
    case "already-broken":
      return {
        lines: ["Koneksi sudah terputus — Hubungkan ulang."],
        warnings: [],
        failures: [],
      };
    case "unreachable":
      return {
        lines: ["Google Drive tidak dapat dihubungi — coba lagi."],
        warnings: [],
        failures: [],
      };
    case "ok": {
      const { sweep } = report;
      const lines = [
        "Token Google Drive berfungsi.",
        ...report.folders.map(
          (check) => `${FOLDER_NAMES[check.folder]}: ${FOLDER_STATES[check.state]}.`,
        ),
        ...(report.dokumen === "skipped" ? [] : [DOKUMEN_LINES[report.dokumen]]),
        ...(sweep.ran
          ? [
              `${sweep.synced} transaksi disinkronkan, ${sweep.waiting} masih menunggu.`,
              `${sweep.documents.synced} dokumen disinkronkan, ${sweep.documents.waiting} masih menunggu.`,
            ]
          : [
              `Sinkronisasi dilewati sampai folder di atas beres; ${sweep.waiting} transaksi dan ${sweep.documentsWaiting} dokumen masih menunggu.`,
            ]),
      ];
      return {
        lines,
        warnings: report.exposed.map(exposureWarning),
        failures: sweep.ran
          ? [
              ...sweep.failures.map(
                (failure) =>
                  `${failure.spentOn} · ${failure.description}: ${FAILURE_REASONS[failure.reason]}.`,
              ),
              ...sweep.documents.failures.map(
                (failure) =>
                  `${failure.documentDate} · ${failure.kind}: ${DOCUMENT_FAILURE_REASONS[failure.reason]}.`,
              ),
            ]
          : [],
      };
    }
  }
}
