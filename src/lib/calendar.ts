import { addDays, diffDays, handledDate, isScheduledOn, nextDueInterval, type Completion } from "@/lib/recurrence";

export type CalKind = "event" | "work" | "cleaning" | "kids" | "skincare" | "meal";
export type CalItem = {
  key: string;
  kind: CalKind;
  sourceId: string;
  date: string;
  time: string | null;
  title: string;
  done: boolean;
  /** Only one-off events can sync to Google (decision 4). */
  google?: boolean;
};

type Sources = {
  events: { id: string; title: string; starts_on: string; start_time: string | null; deleted_at: string | null; sync_to_google: boolean; work_item_id: string | null }[];
  work: { id: string; title: string; due_date: string | null; due_time: string | null; show_in_calendar: boolean; status: string }[];
  cleaning: { id: string; title: string; every_days: number; last_done?: string | null; snoozed_until: string | null; show_in_calendar: boolean }[];
  kids: { id: string; title: string; at_time: string | null; days_of_week: number[] | null; snoozed_until: string | null; show_in_calendar: boolean }[];
  skincare: { id: string; title: string; remind_time: string | null; period: string; days_of_week: number[] | null; snoozed_until: string | null; show_in_calendar: boolean }[];
  meals?: { id: string; on_date: string; slot: string; label: string }[];
  history: (Completion & { source_type: string })[];
};

const MEAL_TIME: Record<string, string> = { breakfast: "08:00", lunchbox: "07:30", lunch: "14:00", snack: "17:00", dinner: "20:00" };

/**
 * Everything that belongs on the calendar between `from` and `to` (inclusive), sorted by date and time.
 * Only items the user marked "show in calendar" appear, plus all one-off events (and meals when asked).
 * Repeating items are projected forward from their rules; nothing is stored per occurrence.
 */
export function calendarItems(src: Sources, from: string, to: string, today: string): CalItem[] {
  const out: CalItem[] = [];
  const inRange = (d: string) => d >= from && d <= to;
  const doneOn = (type: string, id: string, d: string) =>
    src.history.some((h) => h.source_type === type && h.source_id === id && h.on_date === d && h.status === "done");

  for (const e of src.events) {
    if (e.deleted_at || !inRange(e.starts_on)) continue;
    out.push({ key: `event:${e.id}`, kind: "event", sourceId: e.id, date: e.starts_on, time: e.start_time?.slice(0, 5) ?? null, title: e.title, done: false, google: e.sync_to_google });
  }
  const linkedWork = new Set(src.events.filter((e) => e.work_item_id && !e.deleted_at).map((e) => e.work_item_id));
  for (const w of src.work) {
    if (!w.show_in_calendar || !w.due_date || linkedWork.has(w.id) || !inRange(w.due_date)) continue;
    out.push({ key: `work:${w.id}`, kind: "work", sourceId: w.id, date: w.due_date, time: w.due_time?.slice(0, 5) ?? null, title: w.title, done: w.status === "done" });
  }
  for (const c of src.cleaning) {
    if (!c.show_in_calendar) continue;
    const history = src.history.filter((h) => h.source_type === "cleaning");
    let d = nextDueInterval(handledDate(history, c.id, c.last_done ?? null), c.every_days, c.snoozed_until, today);
    if (d < today && diffDays(d, today) > 0) d = today; // overdue shows today, not in the past
    // Done today counts as today's occurrence.
    if (doneOn("cleaning", c.id, today)) out.push({ key: `cleaning:${c.id}:${today}`, kind: "cleaning", sourceId: c.id, date: today, time: null, title: c.title, done: true });
    for (let i = 0; i < 400 && d <= to; i++, d = addDays(d, Math.max(1, c.every_days))) {
      if (d >= from && !(d === today && doneOn("cleaning", c.id, today))) {
        out.push({ key: `cleaning:${c.id}:${d}`, kind: "cleaning", sourceId: c.id, date: d, time: null, title: c.title, done: false });
      }
    }
  }
  const daily = (type: "kids" | "skincare", id: string, title: string, time: string | null, days: number[] | null, snoozed: string | null) => {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (!isScheduledOn(days, d) || (snoozed && snoozed > d)) continue;
      const done = doneOn(type, id, d);
      if (d < today && !done) continue; // the past shows what was done, not every missed day
      out.push({ key: `${type}:${id}:${d}`, kind: type, sourceId: id, date: d, time, title, done });
    }
  };
  for (const k of src.kids) if (k.show_in_calendar) daily("kids", k.id, k.title, k.at_time?.slice(0, 5) ?? null, k.days_of_week, k.snoozed_until);
  for (const s of src.skincare) {
    if (s.show_in_calendar) daily("skincare", s.id, s.title, s.remind_time?.slice(0, 5) ?? (s.period === "evening" ? "21:00" : "07:00"), s.days_of_week, s.snoozed_until);
  }
  for (const m of src.meals ?? []) {
    if (inRange(m.on_date)) out.push({ key: `meal:${m.id}`, kind: "meal", sourceId: m.id, date: m.on_date, time: MEAL_TIME[m.slot] ?? null, title: m.label, done: false });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "99").localeCompare(b.time ?? "99") || a.title.localeCompare(b.title));
}

/** The 6×7 month grid (Saturday first) covering `month` ("YYYY-MM"). */
export function monthGrid(month: string) {
  const first = `${month}-01`;
  const back = (new Date(Date.parse(first)).getUTCDay() + 1) % 7; // days since Saturday
  const start = addDays(first, -back);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
