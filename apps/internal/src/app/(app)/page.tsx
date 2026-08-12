import { requirePerson } from "-/lib/person";
import { STREAMS, TOTAL_SESSIONS_PER_SCHOOL } from "@sugt/domain";

/**
 * Enough of a landing page to prove somebody is signed in. **A greeting is not a
 * dashboard** — the two real ones, Coverage, and the rest of the eighteen internal
 * surfaces each belong to their own spec.
 *
 * It is here to show the two things this feature produces: a Person with a name, and a
 * `role` a Staff-only surface can branch on.
 */
export default async function Home() {
  const person = await requirePerson();

  return (
    <main className="flex flex-col gap-2 p-8">
      <h1 className="font-heading text-lg font-medium">Halo, {person.fullName}.</h1>
      <p className="text-sm text-muted-foreground">
        {STREAMS.join(" · ")} — {TOTAL_SESSIONS_PER_SCHOOL} sesi per sekolah
      </p>
      {person.role === "Staff" && (
        <p className="text-sm text-muted-foreground">
          Anda masuk sebagai Tim DITSAMA, jadi layar khusus Staff terbuka untuk Anda.
        </p>
      )}
    </main>
  );
}
