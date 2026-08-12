import type { ConcernAspect, SchoolSession } from "@sugt/db/queries";
import {
  CONCERN_AT_OR_BELOW,
  RATING_MAX,
  RATING_MIN,
  type SessionMode,
  type SessionStatus,
} from "@sugt/domain";
import { Badge } from "@sugt/ui/components/badge";
import { Rating } from "@sugt/ui/components/rating";

/**
 * One School's Sessions, oldest first.
 *
 * **Only the Sessions that exist.** A School is due ten, and the ten are a denominator
 * rather than a list — a Session comes into existence when it is arranged and never
 * before (ADR-0006), so there are no rows waiting to be filled in. The design handoff
 * lays all ten out with *"Belum dijadwalkan"* against the unplanned ones; that is the
 * schedule ADR-0006 rejects, and it is not built here.
 *
 * A cancelled Session stays in the list with the reason it was called off. It counts
 * for nothing, and that is the point of showing it: a School that was planned for and
 * missed looks different from one nobody has reached yet.
 */
function SchoolSessions({ sessions }: { sessions: SchoolSession[] }) {
  if (sessions.length === 0) {
    return (
      <p className="p-7 text-sm text-muted-foreground">
        Belum ada Sesi yang diatur untuk Sekolah ini.
      </p>
    );
  }

  return (
    <ul className="border-t border-border">
      {sessions.map((session) => (
        <li
          key={session.id}
          className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border-b border-border px-7 py-3"
        >
          <span className="text-sm font-medium tabular-nums">{session.heldOn}</span>
          <span className="text-xs text-muted-foreground">{MODE_LABELS[session.mode]}</span>
          <StatusBadge status={session.status} />

          <span className="ml-auto">
            <ConcernChip session={session} />
          </span>

          {session.cancelledReason !== null && (
            <p className="w-full text-xs text-muted-foreground">
              Alasan pembatalan: {session.cancelledReason}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * What anybody said about this Session, in one chip.
 *
 * **Three states, not two.** Nothing is required and nothing is blocked (ADR-0009), so
 * a delivered Session nobody has filed anything about is ordinary — and *"Tanpa
 * concern"* on one would report a verdict nobody gave. The absence of Ratings is
 * therefore said out loud rather than read as approval.
 *
 * A Session that has not happened yet gets neither: an arranged or cancelled Session
 * has nothing to judge, so the chip is simply absent.
 */
function ConcernChip({ session }: { session: SchoolSession }) {
  if (session.concern !== null) {
    return (
      <Rating
        value={session.concern.rating}
        label={ASPECT_LABELS[session.concern.aspect]}
        variant="compact"
        min={RATING_MIN}
        max={RATING_MAX}
        concernAtOrBelow={CONCERN_AT_OR_BELOW}
      />
    );
  }

  if (session.status !== "delivered") return null;

  return (
    <span className="text-xs text-muted-foreground">
      {session.ratingsFiled > 0 ? "Tanpa concern" : "Belum ada Rating"}
    </span>
  );
}

function StatusBadge({ status }: { status: SessionStatus }) {
  return (
    <Badge variant={status === "cancelled" ? "destructive" : "outline"}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

/**
 * The copy is Indonesian and the domain terms are English — `CONTEXT.md` § *Language*,
 * which is why these are a translation at the edge rather than names in `@sugt/domain`.
 *
 * Typed against the domain's unions rather than as loose records, so an Aspect added to
 * a rubric fails the build here until somebody writes its Indonesian.
 */
const MODE_LABELS: Record<SessionMode, string> = {
  offline: "Luring",
  online: "Daring",
};

const STATUS_LABELS: Record<SessionStatus, string> = {
  arranged: "Terjadwal",
  delivered: "Terlaksana",
  cancelled: "Dibatalkan",
};

const ASPECT_LABELS: Record<ConcernAspect, string> = {
  comprehension: "Pemahaman",
  participation: "Partisipasi",
  readiness: "Kesiapan",
  materials: "Materi",
  delivery: "Penyampaian",
  facilities: "Fasilitas",
  timing: "Waktu",
  turnout: "Kehadiran",
  school_support: "Dukungan Sekolah",
  coordination: "Koordinasi",
  instructor: "Pengajar",
  relevance: "Relevansi",
};

export { SchoolSessions };
