import { describe, expect, it } from "vitest";
import { calendarItems, monthGrid } from "@/lib/calendar";
import { dueReminders } from "@/lib/reminders";

const today = "2026-10-23"; // Friday
const empty = { events: [], work: [], cleaning: [], kids: [], skincare: [], history: [] };

describe("calendar items", () => {
  it("only shows items marked for the calendar", () => {
    const items = calendarItems({
      ...empty,
      work: [
        { id: "w1", title: "Report", due_date: "2026-10-25", due_time: "10:00", show_in_calendar: true, status: "todo" },
        { id: "w2", title: "Hidden", due_date: "2026-10-25", due_time: null, show_in_calendar: false, status: "todo" },
      ],
    }, today, "2026-10-31", today);
    expect(items.map((i) => i.title)).toEqual(["Report"]);
  });
  it("repeats cleaning every N days from the next due date", () => {
    const items = calendarItems({
      ...empty,
      cleaning: [{ id: "c", title: "Mop", every_days: 3, snoozed_until: null, show_in_calendar: true }],
      history: [{ source_type: "cleaning", source_id: "c", on_date: "2026-10-22", status: "done" }],
    }, today, "2026-10-31", today);
    expect(items.map((i) => i.date)).toEqual(["2026-10-25", "2026-10-28", "2026-10-31"]);
  });
  it("puts an overdue cleaning task on today", () => {
    const items = calendarItems({ ...empty, cleaning: [{ id: "c", title: "Mop", every_days: 7, snoozed_until: null, show_in_calendar: true }],
      history: [{ source_type: "cleaning", source_id: "c", on_date: "2026-10-01", status: "done" }] }, today, today, today);
    expect(items[0]?.date).toBe(today);
  });
  it("kids items follow their weekdays and show done", () => {
    const items = calendarItems({
      ...empty,
      kids: [{ id: "k", title: "Swim", at_time: "16:00:00", days_of_week: [5, 1], snoozed_until: null, show_in_calendar: true }],
      history: [{ source_type: "kids", source_id: "k", on_date: today, status: "done" }],
    }, today, "2026-10-27", today);
    expect(items.map((i) => [i.date, i.done])).toEqual([[today, true], ["2026-10-26", false]]);
  });
  it("a work item linked to an event is not shown twice", () => {
    const items = calendarItems({
      ...empty,
      events: [{ id: "e", title: "Report", starts_on: "2026-10-25", start_time: null, deleted_at: null, sync_to_google: true, work_item_id: "w1" }],
      work: [{ id: "w1", title: "Report", due_date: "2026-10-25", due_time: null, show_in_calendar: true, status: "todo" }],
    }, today, "2026-10-31", today);
    expect(items.length).toBe(1);
  });
  it("month grid starts on Saturday and covers 6 weeks", () => {
    const g = monthGrid("2026-10");
    expect(g[0]).toBe("2026-09-26");
    expect(g.length).toBe(42);
  });
});

describe("reminders", () => {
  const data = {
    skincare: [{ id: "s", title: "Sunscreen", remind_time: "08:00:00", days_of_week: null, snoozed_until: null }],
    kids: [{ id: "k", title: "Homework", at_time: "17:00:00", remind: true, days_of_week: [1], snoozed_until: null }],
    work: [{ id: "w", title: "Invoice", due_date: today, due_time: "12:00:00", remind: true, status: "todo" }],
    events: [{ id: "e", title: "Dentist", starts_on: today, start_time: "15:00:00", remind_minutes: 60, deleted_at: null }],
    history: [],
  };
  it("nothing before its time", () => expect(dueReminders(data, today, "07:59")).toEqual([]));
  it("fires each item once its time has come", () =>
    expect(dueReminders(data, today, "14:05").map((r) => r.dedupe_key)).toEqual([`skincare:s:${today}`, `work:w:${today}`, `event:e:${today}`]));
  it("skips items already done", () =>
    expect(dueReminders({ ...data, history: [{ source_type: "skincare", source_id: "s", on_date: today, status: "done" }] }, today, "09:00")).toEqual([]));
  it("kids item off on Friday is not reminded", () => expect(dueReminders(data, today, "18:00").some((r) => r.dedupe_key.startsWith("kids"))).toBe(false));
});
