import { describe, expect, it } from "vitest";
import { fromGoogle, localParts, toGoogle } from "@/lib/gcal";

const tz = "Africa/Cairo";
const base = { id: "n1", title: "Dentist", notes: "", starts_on: "2026-10-30", start_time: "15:00:00", end_time: null, remind_minutes: 30 };

describe("Nest → Google", () => {
  it("timed event gets a default one-hour end and a popup reminder", () => {
    const g = toGoogle(base, tz);
    expect(g.start).toEqual({ dateTime: "2026-10-30T15:00:00", timeZone: tz });
    expect(g.end).toEqual({ dateTime: "2026-10-30T16:00:00", timeZone: tz });
    expect(g.reminders).toEqual({ useDefault: false, overrides: [{ method: "popup", minutes: 30 }] });
    expect(g.extendedProperties?.private?.["nestId"]).toBe("n1");
  });
  it("all-day event ends the next day (Google's rule)", () => {
    const g = toGoogle({ ...base, start_time: null, remind_minutes: null }, tz);
    expect(g.start).toEqual({ date: "2026-10-30" });
    expect(g.end).toEqual({ date: "2026-10-31" });
  });
});

describe("Google → Nest", () => {
  it("converts to Cairo local time (summer time, UTC+3)", () => expect(localParts("2026-10-25T12:00:00Z", tz)).toEqual({ date: "2026-10-25", time: "15:00" }));
  it("after DST ends (UTC+2)", () => expect(localParts("2026-11-05T12:00:00Z", tz)).toEqual({ date: "2026-11-05", time: "14:00" }));
  it("round-trips a timed event (30 Oct: Cairo is back on UTC+2)", () => {
    const back = fromGoogle({ ...toGoogle(base, tz), start: { dateTime: "2026-10-30T15:00:00+02:00" }, end: { dateTime: "2026-10-30T16:00:00+02:00" } }, tz);
    expect(back).toEqual({ title: "Dentist", notes: "", starts_on: "2026-10-30", start_time: "15:00", end_time: "16:00", remind_minutes: 30 });
  });
  it("keeps all-day events all-day", () =>
    expect(fromGoogle({ summary: "Holiday", start: { date: "2026-11-01" }, end: { date: "2026-11-02" } }, tz).start_time).toBeNull());
});
