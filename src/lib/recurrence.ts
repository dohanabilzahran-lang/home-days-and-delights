/**
 * Pure date rules for repeating tasks. All dates are "YYYY-MM-DD" strings in the user's local day,
 * so time zones and daylight saving never shift a task to another day.
 *
 * Cleaning tasks repeat "every N days after the last time it was done or skipped" (decision 9).
 * Kids' and skincare items repeat daily, optionally only on chosen weekdays.
 */

export type Completion = { source_id: string; on_date: string; status: string };

const DAY = 86400000;

export function addDays(date: string, n: number) {
  return new Date(Date.parse(date) + n * DAY).toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string) {
  const d = new Date(Date.parse(date)).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Latest done-or-skipped date for one task, from its history. */
export function lastHandled(history: Completion[], sourceId: string) {
  let latest: string | null = null;
  for (const c of history) if (c.source_id === sourceId && (!latest || c.on_date > latest)) latest = c.on_date;
  return latest;
}

/** Latest date the task was actually done (skips excluded). */
export function lastDone(history: Completion[], sourceId: string) {
  let latest: string | null = null;
  for (const c of history) {
    if (c.source_id === sourceId && c.status === "done" && (!latest || c.on_date > latest)) latest = c.on_date;
  }
  return latest;
}

/**
 * Next due date for an interval task. Never handled → due today.
 * A postponement (snoozedUntil) only ever moves the date later.
 */
export function nextDueInterval(handled: string | null, everyDays: number, snoozedUntil: string | null, today: string) {
  const base = handled ? addDays(handled, Math.max(1, everyDays)) : today;
  return snoozedUntil && snoozedUntil > base ? snoozedUntil : base;
}

/** Whether a weekday-scheduled item happens on this date. Null or empty = every day. */
export function isScheduledOn(daysOfWeek: number[] | null | undefined, date: string) {
  return !daysOfWeek || daysOfWeek.length === 0 || daysOfWeek.includes(isoWeekday(date));
}

/** Status of a daily item for one date. */
export function dailyStatus(
  item: { id: string; days_of_week: number[] | null; snoozed_until: string | null },
  history: Completion[],
  date: string,
): "done" | "skipped" | "postponed" | "off" | "due" {
  const entry = history.find((c) => c.source_id === item.id && c.on_date === date);
  if (entry) return entry.status === "skipped" ? "skipped" : "done";
  if (!isScheduledOn(item.days_of_week, date)) return "off";
  if (item.snoozed_until && item.snoozed_until > date) return "postponed";
  return "due";
}
