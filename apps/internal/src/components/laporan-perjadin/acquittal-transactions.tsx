"use client";

import {
  MAX_RECEIPT_BATCH,
  type ViewableTransaction,
} from "-/app/(app)/perjadin/[id]/laporan/action-types";
import {
  finalizeReceiptsAction,
  mintReceiptUploadsAction,
  recordTransactionAction,
} from "-/app/(app)/perjadin/[id]/laporan/actions";
import {
  formatIdr,
  TRANSACTION_CATEGORIES,
  TRANSACTION_PARTICIPANT_TYPES,
  type TransactionCategory,
  type TransactionParticipantType,
} from "@sugt/domain";
import { Alert, AlertDescription, AlertTitle } from "@sugt/ui/components/alert";
import { Button } from "@sugt/ui/components/button";
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
import { useId, useRef, useState, useTransition } from "react";

/**
 * **The line items, and the two things a PIC does to them**: enter one, and attach the receipts
 * that evidence it.
 *
 * Both are first-class paths rather than a primary and a fallback, which is why the receipt upload
 * sits on the row and not inside the entry form: a fare logged on the pavement is photographed
 * later, and one worked through after returning has its receipt to hand. ADR-0007 rests on both
 * being equally easy.
 *
 * **Nothing here checks the evidence rule.** "Every transaction has at least one piece of evidence"
 * is checked when the Report is filed and nowhere else — a row with no receipt is an ordinary state
 * on this screen, marked but never refused.
 */
function AcquittalTransactions({
  perjadinId,
  transactions,
}: {
  perjadinId: string;
  transactions: ViewableTransaction[];
}) {
  return (
    <div className="border-b border-border px-7 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-sm font-medium">Transaksi</h2>
        <RecordTransaction perjadinId={perjadinId} />
      </div>

      {transactions.length === 0 ? (
        <p className="mt-2.5 text-sm text-muted-foreground">
          Belum ada transaksi terhadap uang muka ini.
        </p>
      ) : (
        <ul className="mt-2.5 divide-y divide-border">
          {transactions.map((line) => (
            <TransactionRow
              key={line.id}
              perjadinId={perjadinId}
              line={line}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** One line item: what it was, which cohort it served, what it cost, and what evidences it. */
function TransactionRow({ perjadinId, line }: { perjadinId: string; line: ViewableTransaction }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 py-2.5 text-sm">
      <div className="min-w-0">
        <p>
          <span className="text-muted-foreground tabular-nums">{line.spentOn}</span>{" "}
          <span>{line.description}</span>
        </p>
        <p className="text-muted-foreground">
          {/* Two axes: what kind of spend, and which cohort it served. Both are always present. */}
          {line.category} · {line.participantType}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <span className="tabular-nums">Rp {formatIdr(line.amountIdr)}</span>
        <Receipts
          perjadinId={perjadinId}
          line={line}
        />
      </div>
    </li>
  );
}

/**
 * The receipts on one line item, and the upload that adds to them.
 *
 * The bytes go straight from the browser to Storage through a signed URL the server mints, so a
 * photograph taken on a phone is not bound by the platform's function body limit. Each landed
 * object is then recorded by a second call, which reads its real content type and size back from
 * Storage rather than believing what this component said about them.
 */
function Receipts({ perjadinId, line }: { perjadinId: string; line: ViewableTransaction }) {
  const [note, setNote] = useState<string | null>(null);
  const [uploading, startUploading] = useTransition();
  const picker = useRef<HTMLInputElement>(null);

  function upload(files: File[]) {
    startUploading(async () => {
      setNote(null);
      const batch = files.slice(0, MAX_RECEIPT_BATCH);

      // The mint throws when the trip is gone, which is a page left open while somebody
      // deleted it in another tab. Caught here rather than left to become an unhandled
      // rejection: the component already knows how to say "muat ulang halaman".
      let targets;
      try {
        targets = await mintReceiptUploadsAction(perjadinId, batch.length);
      } catch {
        setNote(STALE_PAGE);
        return;
      }

      const landed: { path: string }[] = [];
      let failed = 0;
      await Promise.all(
        batch.map(async (file, index) => {
          const target = targets[index];
          if (!target) {
            failed += 1;
            return;
          }
          try {
            const response = await fetch(target.signedUrl, {
              method: "PUT",
              headers: { "content-type": file.type || "application/octet-stream" },
              body: file,
            });
            if (!response.ok) throw new Error(`PUT ${response.status}`);
            landed.push({ path: target.path });
          } catch {
            failed += 1;
          }
        }),
      );

      if (landed.length > 0) {
        const result = await finalizeReceiptsAction(perjadinId, line.id, landed);
        // The write's refusals are answered rather than counted as upload failures. Both
        // mean the page is stale, and neither means a file did not reach Storage.
        if (result.outcome !== "attached") {
          setNote(STALE_PAGE);
          return;
        }
        failed += result.failed;
      }
      // Partial success is real — several files upload independently and one can fail while
      // the rest land — so it is reported rather than swallowed.
      if (failed > 0) setNote(`${failed} berkas gagal diunggah.`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {line.evidence.length === 0 ? (
        <span className="text-muted-foreground">Belum ada bukti</span>
      ) : (
        <span className="flex items-center gap-2">
          {line.evidence.map((file, index) =>
            file.url === null ? (
              // The row exists and its object does not. Said out loud, because a silently
              // missing receipt is what the filing check will refuse without explaining.
              <span
                key={file.id}
                className="text-destructive"
              >
                Bukti {index + 1} hilang
              </span>
            ) : (
              <a
                key={file.id}
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="underline hover:no-underline"
              >
                Bukti {index + 1}
              </a>
            ),
          )}
        </span>
      )}

      <input
        ref={picker}
        type="file"
        accept="image/*,application/pdf"
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
        disabled={uploading}
        onClick={() => picker.current?.click()}
      >
        {uploading ? "Mengunggah…" : "Unggah bukti"}
      </Button>

      {note !== null && <span className="text-destructive">{note}</span>}
    </div>
  );
}

/** The entry form. One line item at a time, which is how a PIC has them. */
function RecordTransaction({ perjadinId }: { perjadinId: string }) {
  const [open, setOpen] = useState(false);
  const [spentOn, setSpentOn] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<TransactionCategory | "">("");
  const [participantType, setParticipantType] = useState<TransactionParticipantType | "">("");
  const [refusal, setRefusal] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const fields = useId();

  const complete =
    spentOn !== "" &&
    description.trim() !== "" &&
    amount !== "" &&
    category !== "" &&
    participantType !== "";

  function submit() {
    startSaving(async () => {
      setRefusal(null);
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
      });

      if (result.outcome === "recorded") {
        setOpen(false);
        setSpentOn("");
        setDescription("");
        setAmount("");
        setCategory("");
        setParticipantType("");
        return;
      }
      setRefusal(REFUSALS[result.outcome]);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
          >
            Catat transaksi
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Catat transaksi</DialogTitle>
          <DialogDescription>
            Satu pengeluaran terhadap uang muka. Bukti bisa dilampirkan menyusul.
          </DialogDescription>
        </DialogHeader>

        {refusal !== null && (
          <Alert variant="destructive">
            <AlertTitle>Transaksi belum tercatat.</AlertTitle>
            <AlertDescription>{refusal}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3.5">
          <div className="grid gap-1.5">
            <Label htmlFor={`${fields}-spent-on`}>Tanggal</Label>
            <Input
              id={`${fields}-spent-on`}
              type="date"
              value={spentOn}
              onChange={(event) => {
                setSpentOn(event.target.value);
              }}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`${fields}-description`}>Keterangan</Label>
            <Input
              id={`${fields}-description`}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`${fields}-amount`}>Jumlah (Rp)</Label>
            {/*
              A masked text input, not `type="number"`: it groups the thousands as they type so a
              large amount's magnitude is legible at the point of entry — the same pattern the plan
              form's Uang muka uses. `amount` stays a plain digit string in state; every non-digit
              is stripped back out on change, so submit's `Number(...)` and the `complete` guard are
              unchanged.
            */}
            <Input
              id={`${fields}-amount`}
              type="text"
              inputMode="numeric"
              value={amount === "" ? "" : `Rp ${formatIdr(Number(amount))}`}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                setAmount(digits);
              }}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`${fields}-category`}>Kategori</Label>
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
              <SelectTrigger id={`${fields}-category`}>
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
            <Label htmlFor={`${fields}-participant-type`}>Tipe Peserta</Label>
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
              <SelectTrigger id={`${fields}-participant-type`}>
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
 * What a page that has gone stale under the reader says. Reached from three places — a mint
 * against a deleted trip, a write that finds no such trip, and one that finds no such line item
 * — because all three mean the same thing to a PIC: what is on screen is no longer what is
 * stored, and no field they could edit will fix it.
 */
const STALE_PAGE = "Halaman ini sudah tidak sesuai. Muat ulang untuk melihat keadaannya.";

/**
 * What each refusal says. `no-such-perjadin` is the only one the form cannot have predicted —
 * somebody deleted the trip while this page was open — so it says to reload rather than which
 * field to fix.
 */
const REFUSALS = {
  "amount-not-positive": "Jumlah harus lebih besar dari nol.",
  "no-such-perjadin": STALE_PAGE,
} as const;

export { AcquittalTransactions };
