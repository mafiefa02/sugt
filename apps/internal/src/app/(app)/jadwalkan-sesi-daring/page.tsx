import { OnlineSessionBatchForm } from "-/components/online-session-batch-form";
import { requirePerson } from "-/lib/person";
import { staffSurface } from "-/lib/staff-surface";
import { onlineSessionBatch } from "@sugt/db/queries";
import { LinkButton } from "@sugt/ui/components/link-button";
import Link from "next/link";

/**
 * **Jadwalkan Sesi daring** — an online Session for each School in a Coverage selection,
 * arranged in one pass.
 *
 * A page rather than a dialog. [#9](https://github.com/mafiefa02/sugt/issues/9) marks
 * Tandai terlaksana and Batalkan Sesi as dialogs and marks this one as neither, and the
 * shape agrees: a dialog holding eleven editable rows is a page with a backdrop.
 *
 * **Staff-only, so the read is too.** `staffSurface` turns `@sugt/db`'s typed refusal
 * into a 403 server-side. Without it on the read, a Teaching Team member who reached
 * this URL directly would be shown the whole form and refused only on submit.
 *
 * The route is named after the surface, the way `/rencanakan-perjadin` is. `/sesi-daring`
 * would have been shorter and would have sat badly beside the `/sesi/[id]` that Detail
 * Sesi ([#28](https://github.com/mafiefa02/sugt/issues/28)) will want.
 */
export default async function Page({ searchParams }: PageProps<"/jadwalkan-sesi-daring">) {
  const person = await requirePerson();
  const { sekolah } = await searchParams;

  const batch = await staffSurface(() => onlineSessionBatch(person, selectionFrom(sekolah)));

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border px-7 py-5">
        <h1 className="font-heading text-lg font-medium">Jadwalkan Sesi daring</h1>
        <p className="text-sm text-muted-foreground">
          Satu Sesi daring untuk setiap Sekolah yang dipilih. Tanggal dan PIC berlaku untuk semua
          baris, dan setiap baris masih dapat diubah sebelum disimpan.
        </p>
      </header>

      {batch.schools.length === 0 ? (
        <div className="flex flex-col items-start gap-3.5 p-7">
          <p className="text-sm text-muted-foreground">
            Tidak ada Sekolah yang dipilih. Pilih Sekolah di Coverage terlebih dahulu.
          </p>
          <LinkButton
            variant="outline"
            render={<Link href="/coverage" />}
          >
            Kembali ke Coverage
          </LinkButton>
        </div>
      ) : (
        <OnlineSessionBatchForm
          schools={batch.schools}
          staff={batch.staff}
          teachingTeam={batch.teachingTeam}
        />
      )}
    </div>
  );
}

/**
 * The Coverage selection, as it survives a URL.
 *
 * Coverage holds the selection in React state and hands it over as `?sekolah=` — the
 * selection is transient, is thrown away on navigation, and is an argument to this
 * screen rather than anything stored. Both shapes a URL can carry are accepted, because
 * both are things a person editing one by hand will write: one comma-separated value, or
 * the parameter repeated.
 *
 * Ids that match no School are not filtered here. `onlineSessionBatch` drops them, and
 * the form lists every School it is about to write a Session for by name, so a dropped
 * id shows up as an absence a reader can see.
 */
function selectionFrom(sekolah: string | string[] | undefined): string[] {
  if (sekolah === undefined) return [];

  return (Array.isArray(sekolah) ? sekolah : [sekolah])
    .flatMap((value) => value.split(","))
    .filter((value) => value.length > 0);
}
