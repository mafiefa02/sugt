import type { MyPerjadinSchool, MyPerjadinSession, MyUpcomingPerjadin } from "@sugt/db/queries";
import type { TimeZone, TransportMode } from "@sugt/domain";

/**
 * **Perjalanan Dinas Anda's trip timeline and money bar** (#349). The ordering, the done/pending state
 * and the spent ratio are plain functions so each rule is testable without React; the card renders
 * what they return, deciding only which controls a Session row offers.
 *
 * `today` is an argument, never read from a clock here: it is a WIB `YYYY-MM-DD` computed on the
 * server and passed down, so the server render and the client hydration agree on which legs are done
 * (a clock read during client render is a hydration mismatch — #302).
 */

/** The fields the timeline reads — a subset of `MyUpcomingPerjadin`. */
export type TimelineTrip = Pick<
  MyUpcomingPerjadin,
  | "departureAt"
  | "departureZone"
  | "departureMode"
  | "returnAt"
  | "returnZone"
  | "returnMode"
  | "schools"
>;

/** One stop on the timeline — a leg of the journey, or an offline Session at one of the Schools. */
export type TimelineNode =
  | {
      kind: "leg";
      key: "departure" | "return";
      /** The wall-clock date, `YYYY-MM-DD`. */
      date: string;
      /** The wall-clock `HH:MM`, seconds dropped, in the leg's own zone. */
      time: string;
      zone: TimeZone;
      mode: TransportMode;
      done: boolean;
    }
  | {
      kind: "session";
      /** The Session's id. */
      key: string;
      /** Carried whole: the row names the School and reads its Time Zone for the start time. */
      school: MyPerjadinSchool;
      session: MyPerjadinSession;
      done: boolean;
    };

/**
 * Departure, then every non-cancelled Session across the trip's Schools by date then start time, then
 * return. A leg is present only when its three fields are — they are null together on a trip planned
 * before the logistics columns (#106) — and is done once its date is **before** `today`, so on
 * departure day the departure is still pending. A Session is done once delivered. Empty when there
 * is no leg and no live Session, and the card then leaves the timeline out.
 */
export function tripTimeline(trip: TimelineTrip, today: string): TimelineNode[] {
  const sessions = trip.schools
    .flatMap((school) => school.sessions.map((session) => ({ school, session })))
    .filter(({ session }) => session.status !== "cancelled")
    // `heldOn` is `YYYY-MM-DD` and `startsAt` is `HH:MM:SS`, so the strings order as the values do.
    // The sort is stable, so a tie keeps the query's School-then-Session order.
    .sort(
      (a, b) =>
        a.session.heldOn.localeCompare(b.session.heldOn) ||
        a.session.startsAt.localeCompare(b.session.startsAt),
    )
    .map(({ school, session }): TimelineNode => ({
      kind: "session",
      key: session.sessionId,
      school,
      session,
      done: session.status === "delivered",
    }));

  const departure = leg(
    "departure",
    trip.departureAt,
    trip.departureZone,
    trip.departureMode,
    today,
  );
  const returnLeg = leg("return", trip.returnAt, trip.returnZone, trip.returnMode, today);

  return [...(departure ? [departure] : []), ...sessions, ...(returnLeg ? [returnLeg] : [])];
}

/** One leg node, or null when the trip does not carry the leg. `at` is `"YYYY-MM-DD HH:MM:SS"`. */
function leg(
  key: "departure" | "return",
  at: string | null,
  zone: TimeZone | null,
  mode: TransportMode | null,
  today: string,
): TimelineNode | null {
  if (at === null || zone === null || mode === null) return null;
  const [date = "", time = ""] = at.split(" ");
  return { kind: "leg", key, date, time: time.slice(0, 5), zone, mode, done: date < today };
}

/**
 * How much of the travel float is spent, as the bar's 0–100 fill: `drawnDownIdr / advanceIdr`,
 * clamped, so an overspend fills the bar rather than overflowing it. No advance means nothing to
 * fill. The Tersisa figure beside it is shown unclamped — only the bar clamps.
 */
export function spentPercent(advanceIdr: number, drawnDownIdr: number): number {
  if (advanceIdr <= 0) return 0;
  return Math.min(100, Math.max(0, (drawnDownIdr / advanceIdr) * 100));
}
