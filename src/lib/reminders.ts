import { dailyStatus, isScheduledOn, type Completion } from "@/lib/recurrence";

export type Reminder = { dedupe_key: string; title: string; body: string; url: string };

type Data = {
  skincare: { id: string; title: string; remind_time: string | null; days_of_week: number[] | null; snoozed_until: string | null }[];
  kids: { id: string; title: string; at_time: string | null; remind: boolean; days_of_week: number[] | null; snoozed_until: string | null; child_name?: string | null }[];
  work: { id: string; title: string; due_date: string | null; due_time: string | null; remind: boolean; status: string }[];
  events: { id: string; title: string; starts_on: string; start_time: string | null; remind_minutes: number | null; deleted_at: string | null }[];
  history: (Completion & { source_type: string })[];
};

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number) as [number, number];
  return h * 60 + m;
};

/**
 * Reminders that are due at `now` (local date + "HH:MM"). Each has a dedupe key, so running this
 * every few minutes, from the app or from the server, never creates the same notification twice.
 * Items already done, skipped, postponed or not scheduled today are left out.
 */
export function dueReminders(data: Data, date: string, time: string): Reminder[] {
  const now = minutes(time);
  const out: Reminder[] = [];
  const hist = (type: string) => data.history.filter((h) => h.source_type === type);

  for (const s of data.skincare) {
    if (!s.remind_time || now < minutes(s.remind_time)) continue;
    if (dailyStatus(s, hist("skincare"), date) !== "due") continue;
    out.push({ dedupe_key: `skincare:${s.id}:${date}`, title: s.title, body: s.remind_time.slice(0, 5), url: "/skincare" });
  }
  for (const k of data.kids) {
    if (!k.remind || !k.at_time || now < minutes(k.at_time)) continue;
    if (dailyStatus(k, hist("kids"), date) !== "due") continue;
    out.push({ dedupe_key: `kids:${k.id}:${date}`, title: k.title, body: [k.child_name, k.at_time.slice(0, 5)].filter(Boolean).join(" · "), url: "/kids" });
  }
  for (const w of data.work) {
    if (!w.remind || !w.due_date || w.status === "done") continue;
    if (w.due_date > date) continue;
    if (w.due_date === date && w.due_time && now < minutes(w.due_time)) continue;
    out.push({ dedupe_key: `work:${w.id}:${w.due_date}`, title: w.title, body: [w.due_date, w.due_time?.slice(0, 5)].filter(Boolean).join(" "), url: "/work" });
  }
  for (const e of data.events) {
    if (e.deleted_at || e.remind_minutes === null || e.starts_on !== date) continue;
    const at = e.start_time ? minutes(e.start_time) - e.remind_minutes : 8 * 60; // all-day: 08:00
    if (now < at) continue;
    out.push({ dedupe_key: `event:${e.id}:${date}`, title: e.title, body: e.start_time?.slice(0, 5) ?? "", url: "/calendar" });
  }
  return out;
}

export { isScheduledOn };
