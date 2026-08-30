import { OrangRoster } from "-/components/orang-roster";
import { requirePerson } from "-/lib/person";
import { roster } from "@sugt/db/queries";

/**
 * **Orang** — the roster, which is also the invite list (`person` is the invite list).
 *
 * One `requirePerson()` and one query, **no role check on the read**: anyone signed in reads the
 * roster, because a Group is assembled from it (ADR-0004). The add and revoke controls render
 * only for Staff, and `requireStaff` inside each write is the enforcement — hiding them is a
 * courtesy, since a layout does not run before a Server Action.
 */
export default async function Page() {
  const person = await requirePerson();
  const people = await roster(person);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border px-7 py-5">
        <h1 className="font-heading text-lg font-medium">Orang</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Roster sekaligus daftar undangan. Siapa pun yang masuk bisa membacanya; hanya DITSAMA yang
          menambah dan menonaktifkan. Peran terkunci setelah seseorang dipakai.
        </p>
      </header>

      <OrangRoster
        people={people}
        canWrite={person.role === "Staff"}
      />
    </div>
  );
}
