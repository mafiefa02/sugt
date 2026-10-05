"use client";

import type {
  DriveRefusal,
  OpenReceiptSessionsResult,
  RecordTransactionActionResult,
  UploadedReceipt,
  ViewableTransaction,
} from "-/app/(app)/perjadin/[id]/laporan/action-types";
import {
  finalizeReceiptsAction,
  openReceiptSessionsAction,
  recordTransactionAction,
} from "-/app/(app)/perjadin/[id]/laporan/actions";
import {
  DEFAULT_TRANSACTION_LIST_CONTROLS,
  sortAndFilterTransactions,
  type CategoryFilter,
  type ParticipantFilter,
  type SortDirection,
} from "-/components/laporan-perjadin/acquittal-transactions-sort";
import { RequiredLegend, RequiredMark } from "-/components/required-mark";
import {
  isAcceptedReceipt,
  MAX_UPLOAD_MEGABYTES,
  prepareReceipt,
  putToDriveSession,
  RECEIPT_ACCEPT,
  UPLOAD_TOO_LARGE,
  UNSUPPORTED_RECEIPT,
  type PreparedReceipt,
} from "-/lib/drive/receipt-upload";
import type { ReceiptUploadGate } from "-/lib/drive/upload-gate";
import { DRIVE_UNREACHABLE } from "-/lib/drive/upload-messages";
import {
  formatIdr,
  formatRupiah,
  MAX_RECEIPTS_PER_TRANSACTION,
  TRANSACTION_CATEGORIES,
  TRANSACTION_PARTICIPANT_TYPES,
  type TransactionCategory,
  type TransactionParticipantType,
} from "@sugt/domain";
import { Alert, AlertDescription, AlertTitle } from "@sugt/ui/components/alert";
import { Badge } from "@sugt/ui/components/badge";
import { Button } from "@sugt/ui/components/button";
import { Card, CardHeader } from "@sugt/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@sugt/ui/components/dialog";
import { Input } from "@sugt/ui/components/input";
import { Label } from "@sugt/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sugt/ui/components/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@sugt/ui/components/tooltip";
import { CloudOff } from "lucide-react";
import { type ReactElement, useId, useMemo, useRef, useState, useTransition } from "react";

/**
 * **The line items, and the two things a PIC does to them**: enter one with its receipts, and add
 * receipts to one already entered.
 *
 * **A line is entered with its evidence or not at all** (ADR-0039, superseding ADR-0030's optional
 * upload). The entry form stages one to five files; Catat uploads every one of them **first** —
 * straight to the company Google Drive (ADR-0040) — and only once all have landed records the line
 * and its evidence in one write. The "log a fare now,
 * attach the receipt later" path is gone on purpose: a spend is not recorded until its receipt is in
 * hand. The row keeps its own "Unggah bukti" for more receipts on a line that has one — up to five in
 * total — and for a line from before the rule that has none.
 *
 * `Receipts` (the row path) already has a `transactionId`, so it attaches as it uploads.
 *
 * The five-receipt ceiling is held by the server (`recordTransaction`, `attachTransactionEvidence`);
 * the disabled buttons here only keep the form from offering the mistake. A row with no receipt can
 * still appear — a grandfathered line — and is marked, and the filing check still refuses it.
 *
 * **While Drive cannot take an upload** — not connected, broken, or its folders unresolved — Catat
 * and every row's Unggah bukti render disabled, and the reason is said once beside Catat. The
 * Server Actions refuse the same states themselves.
 */
function AcquittalTransactions({
  perjadinId,
  transactions,
  uploadGate,
}: {
  perjadinId: string;
  transactions: ViewableTransaction[];
  uploadGate: ReceiptUploadGate;
}) {
  // Sort/filter is a lens on the rendered list only. The list is bounded and already fully loaded,
  // so this is in-memory (no server round-trip, unlike `/feedback`); the Laporan money figures and
  // the CSV export are computed from the full set upstream and are deliberately not routed through
  // `visible`.
  const [amountSort, setAmountSort] = useState<SortDirection>(
    DEFAULT_TRANSACTION_LIST_CONTROLS.amountSort,
  );
  const [dateSort, setDateSort] = useState<SortDirection>(
    DEFAULT_TRANSACTION_LIST_CONTROLS.dateSort,
  );
  const [participantFilter, setParticipantFilter] = useState<ParticipantFilter>(
    DEFAULT_TRANSACTION_LIST_CONTROLS.participantFilter,
  );
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(
    DEFAULT_TRANSACTION_LIST_CONTROLS.categoryFilter,
  );

  const visible = useMemo(
    () =>
      sortAndFilterTransactions(transactions, {
        amountSort,
        dateSort,
        participantFilter,
        categoryFilter,
      }),
    [transactions, amountSort, dateSort, participantFilter, categoryFilter],
  );

  return (
    <div className="border-b border-border px-7 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-sm font-medium">Transaksi</h2>
        <RecordTransaction
          perjadinId={perjadinId}
          uploadGate={uploadGate}
        />
      </div>
      {!uploadGate.open && (
        <p className="mt-1.5 text-sm text-muted-foreground">{uploadGate.reason}</p>
      )}

      {transactions.length === 0 ? (
        <p className="mt-2.5 text-sm text-muted-foreground">
          Belum ada transaksi terhadap Uang Perjalanan ini.
        </p>
      ) : (
        <>
          {/* Two sort dropdowns — amount primary, date tiebreak — both always active, no "off" arm. */}
          <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ControlSelect
              ariaLabel="Urutkan jumlah"
              options={AMOUNT_SORT_OPTIONS}
              value={amountSort}
              onChange={setAmountSort}
            />
            <ControlSelect
              ariaLabel="Urutkan tanggal"
              options={DATE_SORT_OPTIONS}
              value={dateSort}
              onChange={setDateSort}
            />
          </div>

          {/* Two exact-match filters, ANDed; each defaults to "Semua" (no predicate on that axis). */}
          <div className="mt-3 mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ControlSelect
              ariaLabel="Saring tipe peserta"
              options={PARTICIPANT_FILTER_OPTIONS}
              value={participantFilter}
              onChange={setParticipantFilter}
            />
            <ControlSelect
              ariaLabel="Saring kategori"
              options={CATEGORY_FILTER_OPTIONS}
              value={categoryFilter}
              onChange={setCategoryFilter}
            />
          </div>

          {visible.length === 0 ? (
            // Distinct from the "no transactions at all" state above: the filters hid everything.
            <p className="text-sm text-muted-foreground">Tidak ada transaksi yang cocok</p>
          ) : (
            <ul className="space-y-3">
              {visible.map((line) => (
                <li key={line.id}>
                  <TransactionCard
                    perjadinId={perjadinId}
                    line={line}
                    uploadGate={uploadGate}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/**
 * One line item as a card, in the `/feedback` header style: date · description · category, a badge
 * for the cohort it served, and — pushed right — the amount and the existing receipts block. Nothing
 * the old row carried is dropped; there is no rating, so no `destructive` badge.
 */
function TransactionCard({
  perjadinId,
  line,
  uploadGate,
}: {
  perjadinId: string;
  line: ViewableTransaction;
  uploadGate: ReceiptUploadGate;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="text-muted-foreground tabular-nums">{line.spentOn}</span>
          <span className="text-muted-foreground">·</span>
          <span>{line.description}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{line.category}</span>
          <Badge variant="secondary">{line.participantType}</Badge>
          {line.unsynced && <UnsyncedMarker />}
          <div className="ml-auto flex items-center gap-4">
            <span className="tabular-nums">{formatRupiah(line.amountIdr)}</span>
            <Receipts
              perjadinId={perjadinId}
              line={line}
              uploadGate={uploadGate}
            />
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

/** What the "belum tersinkron" marker says, in full, on hover or focus. */
const UNSYNCED_TOOLTIP =
  "Bukti belum tersinkron ke Google Drive — Administrator dapat menyelesaikannya lewat Periksa koneksi.";

/**
 * **A quiet mark on a line whose receipts are not yet in place in Drive** (ADR-0040, #375):
 * recorded, but the reconcile has not finished moving them into the line's folder. Small and muted — nothing is
 * wrong with the line, and nothing is asked of whoever reads it; an Administrator's Periksa koneksi
 * finishes it. The sentence is in the tooltip for a pointer, and spoken in full from an `sr-only`
 * span for a screen reader. The trigger is a real button, so the tooltip opens on keyboard focus.
 */
function UnsyncedMarker() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
          />
        }
      >
        <CloudOff
          aria-hidden
          className="size-3.5"
        />
        <span aria-hidden>belum tersinkron</span>
        <span className="sr-only">{UNSYNCED_TOOLTIP}</span>
      </TooltipTrigger>
      <TooltipContent>{UNSYNCED_TOOLTIP}</TooltipContent>
    </Tooltip>
  );
}

/** The label maps for the four controls. Sort keys are the direction; each filter carries "Semua". */
const AMOUNT_SORT_OPTIONS = { desc: "Termahal", asc: "Termurah" } satisfies Record<
  SortDirection,
  string
>;
const DATE_SORT_OPTIONS = { desc: "Terbaru", asc: "Terlama" } satisfies Record<
  SortDirection,
  string
>;

/** Self-labelled options for a closed value set — keeps the two filters in step with `@sugt/domain`. */
function labelSelf<T extends string>(values: readonly T[]): Record<T, string> {
  const options = {} as Record<T, string>;
  for (const value of values) options[value] = value;
  return options;
}

const PARTICIPANT_FILTER_OPTIONS: Record<ParticipantFilter, string> = {
  Semua: "Semua",
  ...labelSelf(TRANSACTION_PARTICIPANT_TYPES),
};
const CATEGORY_FILTER_OPTIONS: Record<CategoryFilter, string> = {
  Semua: "Semua",
  ...labelSelf(TRANSACTION_CATEGORIES),
};

/**
 * One control dropdown — the `/feedback` `SortSelect`/`FilterSelect` shape, unified because a sort
 * and a filter here are the same widget over an options map with a value that is always a valid key
 * (so no placeholder branch). No `disabled`: the work is in-memory, nothing is ever pending.
 */
function ControlSelect<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  options: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(next) => {
        onChange(next as T);
      }}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className="w-full"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.entries(options) as [T, string][]).map(([key, label]) => (
          <SelectItem
            key={key}
            value={key}
          >
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * The receipts on one line item, and the upload that adds to them.
 *
 * Each receipt is a **Bukti n** link that opens it in Google Drive in a new tab (ADR-0040), and a
 * line with a Drive folder adds **Buka folder**, the link anyone can open once the folder is shared.
 *
 * The upload goes to Drive the same way Catat transaksi's does (ADR-0040): each file prepared in the
 * browser, a session opened per file, the bytes `PUT` straight to Drive. Then `finalizeReceiptsAction`
 * checks each file in Drive and records the ones that pass — **partial success is real here**, since
 * the line already stands — and moves them into the line's folder.
 *
 * A line holds at most `MAX_RECEIPTS_PER_TRANSACTION` in total, so a pick is cut to the slots left
 * and the button is disabled once there are none. There is no receipt deletion, so a mistaken
 * upload uses a slot.
 */
function Receipts({
  perjadinId,
  line,
  uploadGate,
}: {
  perjadinId: string;
  line: ViewableTransaction;
  uploadGate: ReceiptUploadGate;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [uploading, startUploading] = useTransition();
  const picker = useRef<HTMLInputElement>(null);
  // Negative for a line grandfathered with more than five; it gains nothing either way.
  const slotsLeft = MAX_RECEIPTS_PER_TRANSACTION - line.evidence.length;

  function upload(files: File[]) {
    startUploading(async () => {
      setNote(null);
      const batch = files.slice(0, Math.max(0, slotsLeft));
      const notes: string[] = [];
      if (batch.length < files.length) {
        notes.push(`${files.length - batch.length} berkas tidak diunggah: ${CAP_NOTE}`);
      }

      if (batch.length > 0) {
        const { prepared, unsupported, tooLarge } = await prepareAll(batch);
        if (unsupported > 0) notes.push(`${unsupported} berkas: ${UNSUPPORTED_RECEIPT}`);
        if (tooLarge > 0) notes.push(`${tooLarge} berkas: ${UPLOAD_TOO_LARGE}`);

        if (prepared.length > 0) {
          const sent = await uploadToDrive(perjadinId, prepared, line.id);
          if ("refusal" in sent) {
            setNote([...notes, sent.refusal].join(" "));
            return;
          }
          let failed = sent.failed;

          if (sent.landed.length > 0) {
            const result = await finalizeReceiptsAction(perjadinId, line.id, sent.landed);
            // The write's refusals are answered rather than counted as upload failures: none of
            // them means a file did not reach Drive.
            // A refusal is said after anything already noted about the batch, not instead of it.
            if (result.outcome === "too-many-receipts") {
              setNote([...notes, CAP_NOTE].join(" "));
              return;
            }
            if (result.outcome === "no-such-perjadin" || result.outcome === "no-such-transaction") {
              setNote([...notes, STALE_PAGE].join(" "));
              return;
            }
            if (result.outcome !== "attached") {
              setNote([...notes, driveRefusalFor(result)].join(" "));
              return;
            }
            failed += result.failed;
            if (!result.synced && result.attached > 0) notes.push(UNSYNCED_NOTE);
          }
          // Partial success is real — several files upload independently and one can fail while
          // the rest land — so it is reported rather than swallowed.
          if (failed > 0) notes.push(`${failed} berkas gagal diunggah.`);
        }
      }

      if (notes.length > 0) setNote(notes.join(" "));
    });
  }

  return (
    <div className="flex items-center gap-2">
      {line.evidence.length === 0 ? (
        <span className="text-muted-foreground">Belum ada bukti</span>
      ) : (
        <span className="flex items-center gap-2">
          {line.evidence.map((file, index) => (
            <a
              key={file.id}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              Bukti {index + 1}
            </a>
          ))}
        </span>
      )}
      {line.folderUrl !== null && (
        <a
          href={line.folderUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:no-underline"
        >
          Buka folder
        </a>
      )}

      <input
        ref={picker}
        type="file"
        accept={RECEIPT_ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) upload(files);
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={uploading || slotsLeft <= 0 || !uploadGate.open}
        title={uploadGate.open ? undefined : uploadGate.reason}
        onClick={() => picker.current?.click()}
      >
        {uploading ? "Mengunggah…" : "Unggah bukti"}
      </Button>

      {note !== null && <span className="text-destructive">{note}</span>}
    </div>
  );
}

/** The entry form. One line item at a time, which is how a PIC has them. */
function RecordTransaction({
  perjadinId,
  uploadGate,
  trigger,
}: {
  perjadinId: string;
  /** Closed while Drive cannot take an upload: the trigger renders disabled, titled with the reason. */
  uploadGate: ReceiptUploadGate;
  // An optional custom trigger so a card elsewhere can open this exact entry form from its own
  // control. Omitted, the default "Catat transaksi" button renders.
  trigger?: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [spentOn, setSpentOn] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<TransactionCategory | "">("");
  const [participantType, setParticipantType] = useState<TransactionParticipantType | "">("");
  // Files chosen but not yet uploaded — one to five, all PUT by `submit` before the line is
  // recorded. A refusal leaves them staged, so a retry needs no re-pick.
  const [staged, setStaged] = useState<File[]>([]);
  // Picks cut off at the ceiling, said out loud rather than dropped silently — as the row does.
  const [pickNote, setPickNote] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  // Recorded, but the reconcile could not finish in Drive. The line stands; the form is reset and
  // this says so rather than closing as if all were done.
  const [unsynced, setUnsynced] = useState(false);
  const [saving, startSaving] = useTransition();
  const picker = useRef<HTMLInputElement>(null);
  const fields = useId();

  const complete =
    spentOn !== "" &&
    description.trim() !== "" &&
    // Positive, not just present: the server refuses zero, and catching it here keeps a refusal the
    // form can predict from uploading receipts first and leaving them orphaned.
    Number(amount) > 0 &&
    category !== "" &&
    participantType !== "" &&
    staged.length >= 1 &&
    staged.length <= MAX_RECEIPTS_PER_TRANSACTION;

  function reset() {
    setSpentOn("");
    setDescription("");
    setAmount("");
    setCategory("");
    setParticipantType("");
    setStaged([]);
    setPickNote(null);
  }

  /**
   * Upload every staged receipt to Drive, then record the line with them — all or nothing (ADR-0039,
   * ADR-0040). Each file is prepared first (images re-encoded, EXIF stripped; the 50 MB cap), then
   * the server opens a session per file and the bytes go straight to Drive. A failed upload records
   * nothing and keeps every value and every staged file, so "Catat" again retries the whole of it
   * against fresh sessions. Files that did land stay in private `_staging`, which ADR-0040 accepts.
   */
  function submit() {
    startSaving(async () => {
      setRefusal(null);
      setUnsynced(false);

      // A new line is all or nothing: any file that cannot be sent refuses the whole of it.
      const { prepared, unsupported, tooLarge } = await prepareAll(staged);
      if (unsupported > 0) return setRefusal(UNSUPPORTED_RECEIPT);
      if (tooLarge > 0) return setRefusal(UPLOAD_TOO_LARGE);

      const sent = await uploadToDrive(perjadinId, prepared);
      if ("refusal" in sent) {
        setRefusal(sent.refusal);
        return;
      }
      if (sent.failed > 0) {
        setRefusal(retryNote(sent.failed));
        return;
      }

      const result = await recordTransactionAction({
        perjadinId,
        spentOn,
        description: description.trim(),
        // Whole rupiah, which is what the column holds. `amount` holds raw digits (the mask
        // strips everything else on change), so `Number` is finite or `NaN`, and `NaN` fails the
        // positivity check.
        amountIdr: Math.trunc(Number(amount)),
        category: category as TransactionCategory,
        participantType: participantType as TransactionParticipantType,
        receipts: sent.landed,
      });

      // Nothing was written, so the form keeps everything for another try.
      if (result.outcome !== "recorded") {
        setRefusal(refusalFor(result));
        return;
      }

      reset();
      if (result.synced) setOpen(false);
      else setUnsynced(true);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Clear a stale alert when the form is reopened, so a prior refusal does not greet the
        // next entry.
        if (next) {
          setRefusal(null);
          setUnsynced(false);
        }
      }}
    >
      <DialogTrigger
        disabled={!uploadGate.open}
        title={uploadGate.open ? undefined : uploadGate.reason}
        render={
          trigger ?? (
            <Button
              variant="outline"
              size="sm"
            >
              Catat transaksi
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Catat transaksi</DialogTitle>
          <DialogDescription>
            Satu pengeluaran terhadap Uang Perjalanan, beserta buktinya.
          </DialogDescription>
          <RequiredLegend />
        </DialogHeader>

        {refusal !== null && (
          <Alert variant="destructive">
            <AlertTitle>Transaksi belum tercatat.</AlertTitle>
            <AlertDescription>{refusal}</AlertDescription>
          </Alert>
        )}
        {unsynced && (
          <Alert>
            <AlertTitle>Transaksi tercatat.</AlertTitle>
            <AlertDescription>{UNSYNCED_NOTE}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3.5">
          <div className="grid gap-1.5">
            <Label
              htmlFor={`${fields}-spent-on`}
              className="gap-1"
            >
              Tanggal Transaksi
              <RequiredMark />
            </Label>
            <Input
              id={`${fields}-spent-on`}
              aria-required="true"
              type="date"
              value={spentOn}
              onChange={(event) => {
                setSpentOn(event.target.value);
              }}
            />
          </div>

          <div className="grid gap-1.5">
            <Label
              htmlFor={`${fields}-description`}
              className="gap-1"
            >
              Keterangan
              <RequiredMark />
            </Label>
            <Input
              id={`${fields}-description`}
              aria-required="true"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
            />
          </div>

          <div className="grid gap-1.5">
            <Label
              htmlFor={`${fields}-amount`}
              className="gap-1"
            >
              Jumlah (Rp)
              <RequiredMark />
            </Label>
            {/*
              A masked text input, not `type="number"`: it groups the thousands as they type so a
              large amount's magnitude is legible at the point of entry — the same pattern the plan
              form's Uang Perjalanan uses. `amount` stays a plain digit string in state; every non-digit
              is stripped back out on change, so submit's `Number(...)` and the `complete` guard are
              unchanged.
            */}
            <Input
              id={`${fields}-amount`}
              aria-required="true"
              type="text"
              inputMode="numeric"
              value={amount === "" ? "" : formatIdr(Number(amount))}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                setAmount(digits);
              }}
            />
          </div>

          <div className="grid gap-1.5">
            <Label
              htmlFor={`${fields}-category`}
              className="gap-1"
            >
              Kategori
              <RequiredMark />
            </Label>
            {/*
              The twelve come from `@sugt/domain`, which is the same list `transaction_category_check`
              pins in the database. There is no "other" beyond `Lainnya`, which is in the list.
            */}
            <Select
              value={category}
              onValueChange={(value) => {
                setCategory(value as TransactionCategory);
              }}
            >
              <SelectTrigger
                id={`${fields}-category`}
                aria-required="true"
              >
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_CATEGORIES.map((option) => (
                  <SelectItem
                    key={option}
                    value={option}
                  >
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label
              htmlFor={`${fields}-participant-type`}
              className="gap-1"
            >
              Tipe Peserta
              <RequiredMark />
            </Label>
            {/*
              An axis orthogonal to Kategori — which cohort the spend served. The two values come
              from `@sugt/domain`, the same list `transaction_participant_type_check` pins in the
              database. Required, so there is no empty option: a shared cost is attributed to
              whichever type it predominantly served.
            */}
            <Select
              value={participantType}
              onValueChange={(value) => {
                setParticipantType(value as TransactionParticipantType);
              }}
            >
              <SelectTrigger
                id={`${fields}-participant-type`}
                aria-required="true"
              >
                <SelectValue placeholder="Pilih tipe peserta" />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_PARTICIPANT_TYPES.map((option) => (
                  <SelectItem
                    key={option}
                    value={option}
                  >
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="gap-1">
              Bukti
              <RequiredMark />
            </Label>
            <p className="-mt-0.5 text-xs text-muted-foreground">
              1–{MAX_RECEIPTS_PER_TRANSACTION} berkas JPG, PNG, WebP atau PDF, masing-masing paling
              besar {MAX_UPLOAD_MEGABYTES} MB. Foto diperkecil sebelum diunggah.
            </p>
            {/*
              Required and staged, not uploaded on pick: `submit` PUTs them all before it records the
              line, and records nothing unless every one landed. Same picker as the row's `Receipts`
              — image or PDF, many at once, capped at `MAX_RECEIPTS_PER_TRANSACTION`. The control is
              a button, which `aria-required` does not apply to; Catat staying disabled until a file
              is staged is what enforces it here.
            */}
            <input
              ref={picker}
              type="file"
              accept={RECEIPT_ACCEPT}
              multiple
              className="hidden"
              onChange={(event) => {
                const picked = Array.from(event.target.files ?? []);
                event.target.value = "";
                if (picked.length === 0) return;
                // A type outside the four is refused here, before anything is uploaded.
                const chosen = picked.filter(isAcceptedReceipt);
                const next = [...staged, ...chosen];
                setStaged(next.slice(0, MAX_RECEIPTS_PER_TRANSACTION));
                const dropped = next.length - MAX_RECEIPTS_PER_TRANSACTION;
                const notes = [
                  chosen.length < picked.length ? UNSUPPORTED_RECEIPT : null,
                  dropped > 0 ? `${dropped} berkas tidak ditambahkan: ${CAP_NOTE}` : null,
                ].filter((note) => note !== null);
                setPickNote(notes.length > 0 ? notes.join(" ") : null);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving || staged.length >= MAX_RECEIPTS_PER_TRANSACTION}
              onClick={() => picker.current?.click()}
            >
              Unggah bukti
            </Button>

            {pickNote !== null && <p className="text-sm text-destructive">{pickNote}</p>}

            {staged.length > 0 && (
              <ul className="grid gap-1">
                {staged.map((file, index) => (
                  <li
                    key={`${index}-${file.name}`}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate text-muted-foreground">{file.name}</span>
                    <button
                      type="button"
                      className="text-muted-foreground underline hover:no-underline"
                      disabled={saving}
                      onClick={() => {
                        setStaged((current) => current.filter((_, at) => at !== index));
                        setPickNote(null);
                      }}
                    >
                      Hapus
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false);
            }}
          >
            Batal
          </Button>
          <Button
            disabled={saving || !complete}
            onClick={submit}
          >
            {saving ? "Menyimpan…" : "Catat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Get each picked file into shape for Drive (`prepareReceipt`): images re-encoded, EXIF stripped, the
 * cap applied. What could not be prepared is counted by reason; each caller decides what that means.
 */
async function prepareAll(
  files: File[],
): Promise<{ prepared: PreparedReceipt[]; unsupported: number; tooLarge: number }> {
  const results = await Promise.all(files.map(prepareReceipt));
  return {
    prepared: results.filter((result): result is PreparedReceipt => typeof result === "object"),
    unsupported: results.filter((result) => result === "unsupported-type").length,
    tooLarge: results.filter((result) => result === "too-large").length,
  };
}

/**
 * Send prepared receipts to Drive — the step both receipt controls share (ADR-0040). The server
 * opens a session per file (for `transactionId`'s line when it is a row's upload, which also checks
 * the line has a slot for each), then each file's bytes go straight to its session. Answers the Drive
 * ids that landed and how many did not, or the sentence for why no session opened.
 *
 * It records nothing: the entry form hands `landed` to `recordTransactionAction`, the row to
 * `finalizeReceiptsAction`, each with its own answer to a partial failure.
 */
async function uploadToDrive(
  perjadinId: string,
  prepared: PreparedReceipt[],
  transactionId?: string,
): Promise<{ landed: UploadedReceipt[]; failed: number } | { refusal: string }> {
  const sessions = await openReceiptSessionsAction(
    perjadinId,
    prepared.map((file) => ({ size: file.blob.size, contentType: file.contentType })),
    transactionId,
  );
  if (sessions.outcome !== "ready") return { refusal: sessionRefusalFor(sessions) };

  const ids = await Promise.all(
    prepared.map((file, index) => putToDriveSession(sessions.sessionUris[index]!, file.blob)),
  );
  const landed = ids.flatMap((driveFileId) => (driveFileId ? [{ driveFileId }] : []));
  return { landed, failed: ids.length - landed.length };
}

/**
 * What a page that has gone stale under the reader says. Reached from several places — upload
 * sessions against a deleted trip or line, a record that finds no such trip, and a row upload that
 * finds no such trip or line item — because all of them mean the same thing to a PIC: what is on
 * screen is no longer what is stored, and no field they could edit will fix it.
 */
const STALE_PAGE = "Halaman ini sudah tidak sesuai. Muat ulang untuk melihat keadaannya.";

/** The five-receipt ceiling, as each place that meets it says it: a row upload or a dialog pick cut short, or a refused line. */
const CAP_NOTE = `Maksimal ${MAX_RECEIPTS_PER_TRANSACTION} bukti per transaksi.`;

/** Receipts that did not land — nothing is recorded, and "Catat" again retries all of them. */
function retryNote(failed: number) {
  return `${failed} berkas gagal diunggah — coba lagi.`;
}

/** The line stands, but the reconcile did not finish in Drive; the next one will. */
const UNSYNCED_NOTE =
  "Bukti belum tersinkron ke Google Drive. Sinkronisasi akan diselesaikan kemudian; tidak ada yang perlu diulang.";

/** Why Drive cannot take an upload right now: the gate's own sentence, or "try again". */
function driveRefusalFor(result: DriveRefusal) {
  return "reason" in result ? result.reason : DRIVE_UNREACHABLE;
}

/** What each refusal to open upload sessions says. Nothing has been uploaded yet. */
function sessionRefusalFor(result: Exclude<OpenReceiptSessionsResult, { outcome: "ready" }>) {
  switch (result.outcome) {
    case "no-such-perjadin":
    case "no-such-transaction":
      return STALE_PAGE;
    case "evidence-missing":
      return "Lampirkan setidaknya satu bukti.";
    case "too-many-receipts":
      return CAP_NOTE;
    case "too-large":
      return UPLOAD_TOO_LARGE;
    case "unsupported-type":
      return UNSUPPORTED_RECEIPT;
    default:
      return driveRefusalFor(result);
  }
}

/**
 * What each refusal of a new line says. `no-such-perjadin` is the only one the form cannot have
 * predicted — somebody deleted the trip while this page was open — so it says to reload rather
 * than which field to fix. The two receipt-count refusals are ones the form's own guard already
 * rules out; they are answered anyway, since the server is what holds the rule.
 */
function refusalFor(result: Exclude<RecordTransactionActionResult, { outcome: "recorded" }>) {
  switch (result.outcome) {
    case "amount-not-positive":
      return "Jumlah harus lebih besar dari nol.";
    case "no-such-perjadin":
      return STALE_PAGE;
    case "evidence-missing":
      return "Lampirkan setidaknya satu bukti.";
    case "too-many-receipts":
      return CAP_NOTE;
    case "receipt-unverified":
      return `${result.failed} bukti tidak dapat diperiksa di Google Drive — unggah ulang.`;
    case "unsupported-type":
      return UNSUPPORTED_RECEIPT;
    default:
      return driveRefusalFor(result);
  }
}

export { AcquittalTransactions, RecordTransaction, UNSYNCED_TOOLTIP };
