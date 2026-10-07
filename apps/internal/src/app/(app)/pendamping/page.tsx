import { MyPerjadinSection } from "-/components/my-perjadin-section";
import { uploadGate } from "-/lib/drive/upload-gate";
import { requirePerson } from "-/lib/person";
import { myPerjadin } from "@sugt/db/queries";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Pendamping" };

/**
 * **Pendamping** — a Staff member's own trips, and nothing else (#396): a one-line greeting,
 * **Perjalanan Dinas Anda** (the trips not yet over) and **Perjalanan Dinas Sebelumnya** (the ones
 * that are). A past trip keeps every action, because the transactions and the attendance sheets are
 * often finished after it. The cards carry no Laporan line (#419); the Laporan is reached through Edit.
 *
 * **"Pendamping" here is a route/label and collides in name only** with the Perjadin role label
 * (`PERJADIN_ROLE_LABELS.Staff` → "Pendamping"): this is the Staff landing screen, not that trip role.
 *
 * **It is Staff-only, at `/pendamping`** (#265). A Pimpinan — a signed-in, read-only role, on no
 * Group — has no trips here; their home is the Dashboard at `/` (#178), so a non-Staff caller is
 * redirected there. `myPerjadin` is scoped *by* the caller, not gated by role, and the money it
 * carries is open to read (ADR-0026), so it needs no Staff choke point.
 */
export default async function Page() {
  const person = await requirePerson();
  if (person.role !== "Staff") redirect("/");

  const [trips, gate] = await Promise.all([
    myPerjadin(person),
    // Each trip card's Catat Transaksi is closed, with the reason, while Drive is (ADR-0040).
    uploadGate(person),
  ]);
  // The viewer writes every trip listed here (ADR-0048): `myPerjadin` lists only trips whose Group
  // they are in. Threaded from the viewer as #439 asks, so #440's Pendamping Lain — an
  // Administrator viewing another person's trips — passes the Administrator's answer.
  const canWrite = true;

  return (
    <div className="flex min-h-full flex-col gap-6 px-4 py-5 sm:p-7">
      <h1 className="font-heading text-lg font-semibold">
        Selamat datang kembali, {person.fullName}
      </h1>

      {trips.current.length === 0 && trips.previous.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Anda belum tergabung dalam Perjalanan Dinas.
        </p>
      ) : (
        <>
          <MyPerjadinSection
            title="Perjalanan Dinas Anda"
            description="Perjalanan yang belum selesai, dan yang bisa Anda kerjakan pada masing-masing."
            trips={trips.current}
            uploadGate={gate}
            canWrite={canWrite}
          />
          <MyPerjadinSection
            title="Perjalanan Dinas Sebelumnya"
            description="Perjalanan yang sudah selesai, yang terbaru di atas. Transaksi dan dokumennya masih bisa dikerjakan."
            trips={trips.previous}
            uploadGate={gate}
            canWrite={canWrite}
          />
        </>
      )}
    </div>
  );
}
