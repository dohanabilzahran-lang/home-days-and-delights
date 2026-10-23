import { describe, expect, it } from "vitest";
import { addDays, dailyStatus, handledDate, isoWeekday, isScheduledOn, lastDone, lastHandled, nextDueInterval } from "@/lib/recurrence";

const today = "2026-10-23"; // a Friday

describe("interval tasks (cleaning)", () => {
  it("never done → due today", () => expect(nextDueInterval(null, 7, null, today)).toBe(today));
  it("done 3 days ago, weekly → due in 4 days", () => expect(nextDueInterval("2026-10-20", 7, null, today)).toBe("2026-10-27"));
  it("done late counts from the completion day (decision 9)", () =>
    expect(nextDueInterval("2026-10-23", 7, null, today)).toBe("2026-10-30"));
  it("skipping today pushes the next date one interval from today", () =>
    expect(nextDueInterval(lastHandled([{ source_id: "a", on_date: today, status: "skipped" }], "a"), 7, null, today)).toBe("2026-10-30"));
  it("postpone moves the date later", () => expect(nextDueInterval("2026-10-10", 7, "2026-10-25", today)).toBe("2026-10-25"));
  it("postpone never moves a date earlier", () => expect(nextDueInterval("2026-10-20", 7, "2026-10-21", today)).toBe("2026-10-27"));
});

describe("history", () => {
  const h = [
    { source_id: "a", on_date: "2026-10-10", status: "done" },
    { source_id: "a", on_date: "2026-10-17", status: "skipped" },
    { source_id: "b", on_date: "2026-10-22", status: "done" },
  ];
  it("last handled includes skips", () => expect(lastHandled(h, "a")).toBe("2026-10-17"));
  it("last done ignores skips", () => expect(lastDone(h, "a")).toBe("2026-10-10"));
  it("other tasks don't leak in", () => expect(lastDone(h, "c")).toBeNull());
  it("uses the old last_done date when it is newer than the history", () => expect(handledDate(h, "a", "2026-10-20")).toBe("2026-10-20"));
  it("prefers history when it is newer", () => expect(handledDate(h, "a", "2026-10-01")).toBe("2026-10-17"));
  it("old date alone is enough", () => expect(handledDate([], "x", "2026-10-12")).toBe("2026-10-12"));
});

describe("weekday schedules", () => {
  it("knows Friday", () => expect(isoWeekday(today)).toBe(5));
  it("null means every day", () => expect(isScheduledOn(null, today)).toBe(true));
  it("Mon/Wed only is off on Friday", () => expect(isScheduledOn([1, 3], today)).toBe(false));
  it("DST night in Egypt stays on its own day", () => expect(addDays("2026-10-29", 1)).toBe("2026-10-30"));
});

describe("daily status", () => {
  const item = { id: "k", days_of_week: [5], snoozed_until: null };
  it("due when scheduled and not done", () => expect(dailyStatus(item, [], today)).toBe("due"));
  it("done when completed", () => expect(dailyStatus(item, [{ source_id: "k", on_date: today, status: "done" }], today)).toBe("done"));
  it("skipped is recorded", () => expect(dailyStatus(item, [{ source_id: "k", on_date: today, status: "skipped" }], today)).toBe("skipped"));
  it("off on other weekdays", () => expect(dailyStatus(item, [], "2026-10-24")).toBe("off"));
  it("postponed until a later date", () => expect(dailyStatus({ ...item, snoozed_until: "2026-10-24" }, [], today)).toBe("postponed"));
});
