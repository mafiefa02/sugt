import type { SessionDetail } from "@sugt/db/queries";
import { CLASS_KINDS } from "@sugt/domain";

/**
 * What has been filed against this Session, and who still owes what.
 *
 * A read-only block, so a server component: nothing here is interactive, and the two
 * numbers it renders are the payload's.
 */
function SessionRecords({ session }: { session: SessionDetail }) {
  return (
    <div className="border-b border-border px-7 py-5">
      <h2 className="font-heading text-sm font-medium">Catatan</h2>

      {/*
        **Two numbers, side by side, and nothing reconciles them.** `class_record` has no
        foreign key to `session_teacher`, so a Record filed by somebody this Session never
        named is a legal row and filed may legitimately exceed expected. A single
        "4 of 6" would have to pick one of them to be wrong.
      */}
      <dl className="mt-2.5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Catatan Kelas terkumpul</dt>
          <dd className="tabular-nums">{session.classRecordsFiled}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Diharapkan</dt>
          <dd className="tabular-nums">{session.classRecordsExpected}</dd>
        </div>
      </dl>

      {/*
        Expected is the teachers this Session names crossed with the three Classes, so a
        Session naming nobody expects nothing. Saying so is better than a bare zero,
        which reads as a system that has lost the professors.
      */}
      {session.teachers.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Belum ada pengajar yang dicatat, jadi belum ada Catatan Kelas yang diharapkan.
        </p>
      ) : (
        <ul className="mt-3 space-y-1 text-sm">
          {session.teachers.map((teacher) => (
            <li
              key={teacher.stream}
              className="text-muted-foreground"
            >
              <span className="text-foreground">{teacher.fullName}</span> · {teacher.stream}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-6 font-heading text-sm font-medium">Yang belum mengisi</h2>

      {/*
        Empty while the Session is arranged, and that is the criterion rather than an
        oversight: an arranged online Session already names its professors, so a list
        that did not wait for `delivered` would chase people for teaching that has not
        happened. Nothing is required and nothing is blocked (ADR-0009) — naming who has
        not filed is the whole of the enforcement.
      */}
      {session.owed.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {session.status === "delivered"
            ? "Semua catatan yang diharapkan sudah masuk."
            : "Belum ada yang diharapkan sampai Sesi ini ditandai terlaksana."}
        </p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {session.owed.map((owed) => (
            <li
              key={
                owed.kind === "session-record"
                  ? `session-record:${owed.personId}`
                  : `class-record:${owed.personId}:${owed.classKind}`
              }
              className="text-muted-foreground"
            >
              <span className="text-foreground">{owed.fullName}</span>
              {owed.kind === "session-record"
                ? " · Catatan Sesi"
                : ` · Catatan Kelas ${CLASS_LABELS[owed.classKind]}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The three Classes by name. A Class is a cohort of people at one School, so these are
 * audiences and never Streams — every Class is taught in both.
 *
 * The copy is Indonesian and the domain terms are English — `CONTEXT.md` § *Language* —
 * which is why this is a translation at the edge rather than names in `@sugt/domain`. The
 * line is not clean and is not meant to be: *Catatan Kelas* and *Catatan Sesi* are
 * translated because they are what somebody is asked to fill in, while `Rating`, `Stream`,
 * `Perjadin` and `PIC` stay as they are because they are what the Programme calls them.
 *
 * **`Student` reads as `Siswa` and the other two do not translate at all.** GTK and MS are
 * already Indonesian initialisms; spelling them out would be inventing a name nobody uses.
 * `docs/research/handoff-vs-docs.md` flags *Siswa* as drift from the handoff — it is kept
 * here because *Student* beside two Indonesian initialisms reads as an oversight.
 */
const CLASS_LABELS: Record<(typeof CLASS_KINDS)[number], string> = {
  GTK: "GTK",
  MS: "MS",
  Student: "Siswa",
};

export { SessionRecords };
