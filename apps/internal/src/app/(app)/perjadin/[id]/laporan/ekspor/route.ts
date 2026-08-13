import { requirePerson } from "-/lib/person";
import { staffSurface } from "-/lib/staff-surface";
import { perjadinAcquittal, type PerjadinAcquittal } from "@sugt/db/queries";
import { notFound } from "next/navigation";

/**
 * **The generic export.**
 *
 * ADR-0007 promises a filled acquittal template and its amendment explains why this is not one
 * yet: nobody has filed an acquittal for this Programme, and no prior trip's completed set is
 * available to borrow, so there is no real form to fill. The screen ships anyway, with a plain
 * itemisation the PIC attaches.
 *
 * **The constraint on it is that it invents nothing**, and that constraint is structural here
 * rather than a promise: every column below is read off `perjadinAcquittal`, the same payload the
 * screen renders. There is no cost-centre, no account code, no payee and no `Ref Standar Biaya` —
 * the last of which the approved budget does carry, and which stays out until a real form asks for
 * it. A view over existing columns cannot be wrong when the real SPJ arrives; it is simply
 * replaced.
 *
 * **A Route Handler rather than a Server Action**, because the response is a file: it needs its own
 * content type and a `Content-Disposition`, neither of which an action can set.
 *
 * Staff-only, by the same choke point the screen uses. A Route Handler runs no layout, so
 * `perjadinAcquittal` refusing a Teaching Team `Person` is the whole of the guard — which is
 * exactly what that choke point is for.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/perjadin/[id]/laporan/ekspor">,
) {
  const person = await requirePerson();
  const { id } = await params;

  const acquittal = await staffSurface(() => perjadinAcquittal(person, id));
  if (!acquittal) notFound();

  return new Response(csvOf(acquittal), {
    headers: {
      // `charset=utf-8` is load-bearing: the categories are Indonesian and the descriptions are
      // whatever a PIC typed, so a reader defaulting to a single-byte encoding mangles both.
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${fileNameOf(acquittal)}"`,
      // The figures change whenever a line item does, and it is money. Nothing caches it.
      "cache-control": "no-store",
    },
  });
}

/**
 * The itemisation, plus the reconciliation as trailing rows.
 *
 * The totals ride in the same file rather than in a second one because the point of the export is
 * that nothing is retyped — a PIC who has to add the column up themselves has been handed a
 * spreadsheet with extra steps.
 */
function csvOf(acquittal: PerjadinAcquittal): string {
  const rows = [
    ["Tanggal", "Keterangan", "Kategori", "Atas nama", "Jumlah (Rp)", "Jumlah bukti"],
    ...acquittal.transactions.map((line) => [
      line.spentOn,
      line.description,
      line.category,
      line.incurredBy?.fullName ?? "",
      String(line.amountIdr),
      String(line.evidence.length),
    ]),
    [],
    ["Uang muka", "", "", "", String(acquittal.advanceIdr), ""],
    ["Terpakai", "", "", "", String(acquittal.spentIdr), ""],
    ["Sisa", "", "", "", String(acquittal.remainderIdr), ""],
  ];

  // A leading BOM, because the reader this file is opened in is Excel and Excel reads a UTF-8 CSV
  // as the system code page without one. That mangles every category name.
  return `﻿${rows.map((row) => row.map(quoted).join(",")).join("\r\n")}\r\n`;
}

/**
 * One CSV field.
 *
 * Everything is quoted rather than only the fields that need it: a description is free text and a
 * destination can carry a comma, and a rule with no exceptions is one nobody has to check. An
 * embedded quote doubles, which is the whole of RFC 4180's escaping.
 */
function quoted(field: string): string {
  return `"${field.replaceAll('"', '""')}"`;
}

/** `laporan-perjadin-bandung-2026-09-01.csv` — the trip and its start, so a folder of them sorts. */
function fileNameOf(acquittal: PerjadinAcquittal): string {
  const slug = acquittal.destination
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `laporan-perjadin-${slug || "perjadin"}-${acquittal.startsOn}.csv`;
}
