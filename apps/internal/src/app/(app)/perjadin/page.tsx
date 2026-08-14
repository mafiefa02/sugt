import { requirePerson } from "-/lib/person";
import { perjadinDirectory } from "@sugt/db/queries";
import Link from "next/link";

/**
 * **Perjadin** — every trip, newest first.
 *
 * One `requirePerson()`, one query, no role check: a trip's dates, its destination and how
 * many Schools it reaches are delivery data, and ADR-0004 opens that to everyone signed in.
 * The Advance is not here at all — it is `perjadinAcquittal`'s, behind the Staff-only choke
 * point, so a professor's list is money that was never fetched.
 *
 * The route keeps the `/perjadin` slug [#14](https://github.com/mafiefa02/sugt/issues/14)
 * chose. It mirrors the surface name enumerated in
 * [#9](https://github.com/mafiefa02/sugt/issues/9), it is the word the sidebar already
 * uses, and it is what a Perjadin is called in every other document — renaming it would
 * make the URL the one place the Programme's own term is avoided.
 */
export default async function Page() {
  const person = await requirePerson();
  const trips = await perjadinDirectory(person);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border px-7 py-5">
        <h1 className="font-heading text-lg font-medium">Perjadin</h1>
        <p className="text-sm text-muted-foreground">
          Setiap perjalanan dinas, yang terbaru di atas. Perjadin direncanakan dari menu Rencanakan
          Perjadin.
        </p>
      </header>

      {trips.length === 0 ? (
        <p className="p-7 text-sm text-muted-foreground">
          Belum ada Perjadin. Buka Rencanakan Perjadin untuk merencanakan yang pertama.
        </p>
      ) : (
        <ul className="border-t border-border">
          {trips.map((trip) => (
            <li
              key={trip.id}
              className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border-b border-border px-7 py-3"
            >
              <Link
                href={`/perjadin/${trip.id}`}
                className="text-sm font-medium hover:underline"
              >
                {trip.destination}
              </Link>
              <span className="text-sm text-muted-foreground tabular-nums">
                {trip.startsOn} – {trip.endsOn}
              </span>
              <span className="text-xs text-muted-foreground">PIC {trip.picFullName}</span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {trip.schoolCount} Sekolah
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
