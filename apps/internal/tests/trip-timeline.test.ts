import { spentPercent, tripTimeline, type TimelineTrip } from "-/components/trip-timeline";
import type { MyPerjadinSchool, MyPerjadinSession } from "@sugt/db/queries";
import { describe, expect, it } from "vitest";

/**
 * **Perjalanan Dinas Anda's trip timeline and money bar** (#349), pinned with no database and no DOM.
 * The card only renders what `tripTimeline` returns: departure, every live Session across Schools in
 * date-then-time order, return — each done or pending against a `today` passed in, never read from a
 * clock here.
 */

const session = (
  sessionId: string,
  heldOn: string,
  startsAt: string,
  status: MyPerjadinSession["status"] = "arranged",
): MyPerjadinSession => ({ sessionId, heldOn, startsAt, status });

const school = (schoolId: string, sessions: MyPerjadinSession[]): MyPerjadinSchool => ({
  schoolId,
  name: `SMA ${schoolId}`,
  kabupatenKota: "Kabupaten Contoh",
  timeZone: "WIB",
  sessions,
});

const trip = (overrides: Partial<TimelineTrip> = {}): TimelineTrip => ({
  departureAt: "2026-09-15 10:00:00",
  departureZone: "WIB",
  departureMode: "Pesawat",
  returnAt: "2026-09-18 16:30:00",
  returnZone: "WIT",
  returnMode: "Kereta",
  schools: [],
  ...overrides,
});

/** Each node's identity, in order — enough to read the sequence at a glance. */
const keys = (t: TimelineTrip, today = "2026-09-01") => tripTimeline(t, today).map((n) => n.key);

describe("tripTimeline", () => {
  it("opens with departure and closes with return, the date and HH:MM read off the wall clock", () => {
    const nodes = tripTimeline(trip(), "2026-09-01");
    expect(nodes).toEqual([
      {
        kind: "leg",
        key: "departure",
        date: "2026-09-15",
        time: "10:00",
        zone: "WIB",
        mode: "Pesawat",
        done: false,
      },
      {
        kind: "leg",
        key: "return",
        date: "2026-09-18",
        time: "16:30",
        zone: "WIT",
        mode: "Kereta",
        done: false,
      },
    ]);
  });

  it("drops a leg whose fields are null, as on a trip planned before the logistics columns", () => {
    const pre106 = trip({
      departureAt: null,
      departureZone: null,
      departureMode: null,
      returnAt: null,
      returnZone: null,
      returnMode: null,
      schools: [school("a", [session("s1", "2026-09-16", "09:00:00")])],
    });
    expect(keys(pre106)).toEqual(["s1"]);
  });

  it("drops cancelled Sessions", () => {
    const t = trip({
      schools: [
        school("a", [
          session("live", "2026-09-16", "09:00:00"),
          session("gone", "2026-09-16", "13:00:00", "cancelled"),
        ]),
      ],
    });
    expect(keys(t)).toEqual(["departure", "live", "return"]);
  });

  it("interleaves Sessions from several Schools by date, then start time", () => {
    const t = trip({
      schools: [
        school("a", [
          session("a-17", "2026-09-17", "08:00:00"),
          session("a-16", "2026-09-16", "13:30:00"),
        ]),
        school("b", [
          session("b-16", "2026-09-16", "09:00:00"),
          session("b-17", "2026-09-17", "10:00:00"),
        ]),
      ],
    });
    expect(keys(t)).toEqual(["departure", "b-16", "a-16", "a-17", "b-17", "return"]);
  });

  it("carries each Session's School for the row's name and time zone", () => {
    const b = school("b", [session("s1", "2026-09-16", "09:00:00")]);
    const node = tripTimeline(trip({ schools: [b] }), "2026-09-01")[1];
    expect(node).toMatchObject({ kind: "session", key: "s1", school: b, session: b.sessions[0] });
  });

  it("keeps a leg dated today pending and marks one dated yesterday done", () => {
    const t = trip({ departureAt: "2026-09-15 10:00:00", returnAt: "2026-09-16 10:00:00" });
    const onDepartureDay = tripTimeline(t, "2026-09-15");
    expect(onDepartureDay.map((n) => n.done)).toEqual([false, false]);
    const dayAfter = tripTimeline(t, "2026-09-16");
    expect(dayAfter.map((n) => n.done)).toEqual([true, false]);
  });

  it("marks a delivered Session done and an arranged one pending, whatever the date", () => {
    const t = trip({
      schools: [
        school("a", [
          session("delivered", "2026-09-16", "09:00:00", "delivered"),
          session("arranged", "2026-09-16", "13:00:00"),
        ]),
      ],
    });
    const nodes = tripTimeline(t, "2026-12-31").filter((n) => n.kind === "session");
    expect(nodes.map((n) => [n.key, n.done])).toEqual([
      ["delivered", true],
      ["arranged", false],
    ]);
  });

  it("is empty when there are no legs and no live Sessions", () => {
    const empty = trip({
      departureAt: null,
      departureZone: null,
      departureMode: null,
      returnAt: null,
      returnZone: null,
      returnMode: null,
      schools: [school("a", [session("gone", "2026-09-16", "09:00:00", "cancelled")])],
    });
    expect(tripTimeline(empty, "2026-09-01")).toEqual([]);
  });
});

describe("spentPercent", () => {
  it("is the draw-down over the advance, as a percentage", () => {
    expect(spentPercent(1_000_000, 250_000)).toBe(25);
  });

  it("clamps an overspend to 100", () => {
    expect(spentPercent(1_000_000, 1_050_000)).toBe(100);
  });

  it("is 0 when there is no advance to fill", () => {
    expect(spentPercent(0, 0)).toBe(0);
    expect(spentPercent(0, 50_000)).toBe(0);
  });

  it("never falls below 0", () => {
    expect(spentPercent(1_000_000, -10_000)).toBe(0);
  });
});
