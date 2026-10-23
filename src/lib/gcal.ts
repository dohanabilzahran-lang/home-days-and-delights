import { addDays } from "@/lib/recurrence";

/** The Nest fields that sync with Google. Times are local "HH:MM" in the user's time zone. */
export type NestEventFields = {
  title: string;
  notes: string;
  starts_on: string;
  start_time: string | null;
  end_time: string | null;
  remind_minutes: number | null;
};

export type GoogleEvent = {
  id?: string;
  etag?: string;
  status?: string;
  updated?: string;
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  reminders?: { useDefault: boolean; overrides?: { method: string; minutes: number }[] };
  extendedProperties?: { private?: Record<string, string> };
};

const hhmm = (t: string) => t.slice(0, 5);
function plusHour(t: string) {
  const [h, m] = hhmm(t).split(":").map(Number) as [number, number];
  return `${String(Math.min(23, h + 1)).padStart(2, "0")}:${String(h >= 23 ? 59 : m).padStart(2, "0")}`;
}

/** Nest event → Google event body. A reminder becomes a Google popup reminder (Google's own notifications). */
export function toGoogle(e: NestEventFields & { id: string }, timeZone: string): GoogleEvent {
  const timed = !!e.start_time;
  return {
    summary: e.title,
    description: e.notes || "",
    start: timed ? { dateTime: `${e.starts_on}T${hhmm(e.start_time!)}:00`, timeZone } : { date: e.starts_on },
    end: timed
      ? { dateTime: `${e.starts_on}T${hhmm(e.end_time && e.end_time > e.start_time! ? e.end_time : plusHour(e.start_time!))}:00`, timeZone }
      : { date: addDays(e.starts_on, 1) },
    reminders: e.remind_minutes === null
      ? { useDefault: false, overrides: [] }
      : { useDefault: false, overrides: [{ method: "popup", minutes: timed ? e.remind_minutes : 0 }] },
    extendedProperties: { private: { nestId: e.id } },
  };
}

/** Local date and time of an RFC 3339 instant in a time zone. */
export function localParts(dateTime: string, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(dateTime))
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p["year"]}-${p["month"]}-${p["day"]}`, time: `${p["hour"]}:${p["minute"]}` };
}

/** Google event → Nest fields. Multi-day events are kept on their first day. */
export function fromGoogle(g: GoogleEvent, timeZone: string): NestEventFields {
  const popup = g.reminders?.overrides?.find((o) => o.method === "popup");
  if (g.start?.dateTime) {
    const s = localParts(g.start.dateTime, timeZone);
    const e = g.end?.dateTime ? localParts(g.end.dateTime, timeZone) : null;
    return {
      title: g.summary || "(No title)", notes: g.description ?? "", starts_on: s.date, start_time: s.time,
      end_time: e && e.date === s.date ? e.time : null, remind_minutes: popup ? popup.minutes : null,
    };
  }
  return {
    title: g.summary || "(No title)", notes: g.description ?? "", starts_on: g.start?.date ?? "", start_time: null, end_time: null,
    remind_minutes: popup ? 0 : null,
  };
}
