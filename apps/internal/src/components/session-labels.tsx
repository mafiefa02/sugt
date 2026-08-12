import type { SessionMode, SessionStatus } from "@sugt/domain";
import { Badge } from "@sugt/ui/components/badge";

/**
 * How a Session's mode and status are written on screen, in one place.
 *
 * **One place because there are two screens and they had already drifted.** Detail Sekolah
 * lists Sessions and Detail Sesi opens one; a Session that reads *Terjadwal* in the list
 * and something else on its own page is the same row disagreeing with itself, and the
 * badge is the part a reader checks fastest.
 *
 * The copy is Indonesian and the domain terms are English — `CONTEXT.md` § *Language* —
 * which is why these are a translation at the edge rather than names in `@sugt/domain`.
 * Typed against the domain's unions rather than as loose records, so a status added there
 * fails the build here until somebody writes its Indonesian.
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

/**
 * The Session's state as one badge.
 *
 * A cancelled Session is the loud one, and that is deliberate: it is the only status that
 * says something did not happen. `arranged` and `delivered` are both ordinary.
 */
function SessionStatusBadge({ status }: { status: SessionStatus }) {
  return (
    <Badge variant={status === "cancelled" ? "destructive" : "outline"}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export { MODE_LABELS, SessionStatusBadge, STATUS_LABELS };
