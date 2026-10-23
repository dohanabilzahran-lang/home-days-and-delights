import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { useLang, type Key } from "@/lib/i18n";
import { todayISO, useTableMutations, type Row } from "@/lib/data";
import { addDays } from "@/lib/recurrence";
import { monthGrid, type CalItem, type CalKind } from "@/lib/calendar";
import { weekDates, weekStart } from "@/lib/meals";
import { shiftMonth } from "@/lib/budget";
import { useCalendarItems } from "@/lib/useCalendar";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { FormDialog, Field } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — Nest" }, { name: "description", content: "Month, week, day and agenda views of everything planned." }] }),
  component: CalendarPage,
});

type View = "month" | "week" | "day" | "agenda";
type Event = Row<"events">;

const KIND_DOT: Record<CalKind, string> = {
  event: "bg-primary", work: "bg-chart-2", cleaning: "bg-chart-3", kids: "bg-chart-4", skincare: "bg-chart-5", meal: "bg-sand",
};
const KIND_LINK: Record<Exclude<CalKind, "event">, "/work" | "/cleaning" | "/kids" | "/skincare" | "/meals"> = {
  work: "/work", cleaning: "/cleaning", kids: "/kids", skincare: "/skincare", meal: "/meals",
};

function useDateText() {
  const { lang } = useLang();
  const loc = lang === "ar" ? "ar-EG" : "en-GB";
  return (date: string, opts: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00:00Z`).toLocaleDateString(loc, { ...opts, timeZone: "UTC" });
}

function CalendarPage() {
  const { t } = useLang();
  const fmt = useDateText();
  const today = todayISO();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(today);
  const [withMeals, setWithMeals] = useState(false);
  const [editing, setEditing] = useState<Partial<Event> | null>(null);

  const month = cursor.slice(0, 7);
  const grid = monthGrid(month);
  const week = weekDates(weekStart(cursor));
  const [from, to] =
    view === "month" ? [grid[0]!, grid[41]!] : view === "week" ? [week[0]!, week[6]!] : view === "day" ? [cursor, cursor] : [today, addDays(today, 30)];
  const { items, events } = useCalendarItems(from, to, withMeals);
  const on = (d: string) => items.filter((i) => i.date === d);

  const step = (n: number) =>
    setCursor(view === "month" ? `${shiftMonth(month, n)}-01` : view === "week" ? addDays(cursor, 7 * n) : addDays(cursor, n));
  const title =
    view === "month" ? fmt(cursor, { month: "long", year: "numeric" })
    : view === "week" ? `${fmt(week[0]!, { day: "numeric", month: "short" })} – ${fmt(week[6]!, { day: "numeric", month: "short" })}`
    : view === "day" ? fmt(cursor, { weekday: "long", day: "numeric", month: "long" })
    : t("view_agenda");
  const openItem = (i: CalItem) => i.kind === "event" && setEditing(events.find((e) => e.id === i.sourceId) ?? null);

  const ItemLine = ({ i, compact }: { i: CalItem; compact?: boolean }) => {
    const body = (
      <>
        <span className={`size-2 shrink-0 rounded-full ${KIND_DOT[i.kind]}`} aria-hidden />
        {i.time && !compact && <span className="tabular-nums text-muted-foreground">{i.time}</span>}
        <span className={`truncate ${i.done ? "text-muted-foreground line-through" : ""}`}>{i.title}</span>
        {i.google && !compact && <RefreshCw className="size-3 shrink-0 text-muted-foreground" aria-label="Google" />}
      </>
    );
    const cls = `flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-start hover:bg-secondary ${compact ? "text-[11px]" : "text-sm"}`;
    return i.kind === "event"
      ? <button type="button" className={cls} onClick={() => openItem(i)}>{body}</button>
      : <Link to={KIND_LINK[i.kind]} className={cls} title={t(`kind_${i.kind}` as Key)}>{body}</Link>;
  };

  return (
    <>
      <PageHeader title={t("calendar")}>
        <Button className="rounded-full" onClick={() => setEditing({ starts_on: view === "agenda" ? today : cursor })}>
          <Plus className="size-4" /> {t("newEvent")}
        </Button>
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {view !== "agenda" && (
            <>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="‹" onClick={() => step(-1)}><ChevronLeft className="size-4 rtl:rotate-180" /></Button>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="›" onClick={() => step(1)}><ChevronRight className="size-4 rtl:rotate-180" /></Button>
            </>
          )}
          <h2 className="px-2 text-xl">{title}</h2>
          {cursor !== today && <Button variant="outline" size="sm" className="rounded-full" onClick={() => setCursor(today)}>{t("todayBtn")}</Button>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <input type="checkbox" className="size-4" checked={withMeals} onChange={(e) => setWithMeals(e.target.checked)} /> {t("showMeals")}
          </label>
          <div className="flex rounded-full bg-muted p-1" role="radiogroup">
            {(["month", "week", "day", "agenda"] as const).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)}
                className={`rounded-full px-3 py-1 text-sm ${view === v ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
                {t(`view_${v}` as Key)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "month" && (
        <div className="card-soft overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border text-center text-xs text-muted-foreground">
            {grid.slice(0, 7).map((d) => <div key={d} className="py-2">{fmt(d, { weekday: "short" })}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((d) => {
              const list = on(d);
              return (
                <div key={d} className={`min-h-24 min-w-0 border-b border-e border-border p-1 ${d.slice(0, 7) !== month ? "bg-muted/40 text-muted-foreground" : ""}`}>
                  <button type="button" onClick={() => { setCursor(d); setView("day"); }}
                    className={`mb-0.5 flex size-6 items-center justify-center rounded-full text-xs ${d === today ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
                    {Number(d.slice(8))}
                  </button>
                  {list.slice(0, 3).map((i) => <ItemLine key={i.key} i={i} compact />)}
                  {list.length > 3 && (
                    <button type="button" className="px-1.5 text-[11px] text-muted-foreground" onClick={() => { setCursor(d); setView("day"); }}>
                      {t("moreCount", { n: list.length - 3 })}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="grid gap-3 md:grid-cols-7">
          {week.map((d) => (
            <section key={d} className="card-soft min-w-0 p-3">
              <button type="button" onClick={() => { setCursor(d); setView("day"); }}
                className={`mb-2 rounded-full px-2 py-0.5 text-sm font-medium ${d === today ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
                {fmt(d, { weekday: "short", day: "numeric" })}
              </button>
              <div className="space-y-0.5">
                {on(d).length === 0 ? <p className="px-1.5 text-xs text-muted-foreground">—</p> : on(d).map((i) => <ItemLine key={i.key} i={i} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {view === "day" && (
        <section className="card-soft p-4">
          {on(cursor).length === 0 ? <p className="p-4 text-center text-muted-foreground">{t("nothingPlanned")}</p>
            : <div className="space-y-1">{on(cursor).map((i) => <ItemLine key={i.key} i={i} />)}</div>}
        </section>
      )}

      {view === "agenda" && (
        <div className="space-y-4">
          {items.length === 0 && <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">{t("nothingPlanned")}</p>}
          {[...new Set(items.map((i) => i.date))].map((d) => (
            <section key={d} className="card-soft p-4">
              <h3 className="mb-2 text-lg">{fmt(d, { weekday: "long", day: "numeric", month: "long" })}</h3>
              <div className="space-y-1">{on(d).map((i) => <ItemLine key={i.key} i={i} />)}</div>
            </section>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">{t("calendarHint")}</p>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(Object.keys(KIND_DOT) as CalKind[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${KIND_DOT[k]}`} />{t(`kind_${k}` as Key)}</span>
        ))}
      </div>

      {editing && <EventDialog key={editing.id ?? "new"} event={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

/** Create or edit a one-off event. Deleting a Google-synced event asks Google sync to remove it too, after confirmation. */
function EventDialog({ event, onClose }: { event: Partial<Event>; onClose: () => void }) {
  const { t } = useLang();
  const { add, update, remove } = useTableMutations("events");
  const [title, setTitle] = useState(event.title ?? "");
  const [date, setDate] = useState(event.starts_on ?? todayISO());
  const [start, setStart] = useState(event.start_time?.slice(0, 5) ?? "");
  const [end, setEnd] = useState(event.end_time?.slice(0, 5) ?? "");
  const [notes, setNotes] = useState(event.notes ?? "");
  const [remind, setRemind] = useState(event.remind_minutes === null || event.remind_minutes === undefined ? "" : String(event.remind_minutes));
  const [google, setGoogle] = useState(event.sync_to_google ?? false);

  function save() {
    if (!title.trim()) return;
    const values = {
      title: title.trim(), starts_on: date, start_time: start || null, end_time: start && end ? end : null, notes,
      remind_minutes: remind === "" ? null : Number(remind), sync_to_google: google,
      // Any change to a synced event is pushed to Google on the next sync.
      sync_state: google ? "pending" : event.google_event_id ? "pending" : "local",
      updated_at: new Date().toISOString(),
    };
    if (event.id) update.mutate({ id: event.id, values }, { onSuccess: onClose });
    else add.mutate(values, { onSuccess: onClose });
  }

  function del() {
    if (!event.id) return;
    // A synced event is kept (hidden) until Google sync removes it there too.
    if (event.google_event_id) {
      update.mutate({ id: event.id, values: { deleted_at: new Date().toISOString(), sync_state: "delete_requested_by_nest" } }, { onSuccess: onClose });
    } else remove.mutate(event.id, { onSuccess: onClose });
  }

  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={event.id ? t("edit") : t("newEvent")} onSubmit={save}>
      <Field id="ev-title" label={t("title")}>
        <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field id="ev-date" label={t("date")}>
          <Input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field id="ev-start" label={t("startTime")}>
          <Input id="ev-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field id="ev-end" label={t("endTime")}>
          <Input id="ev-end" type="time" disabled={!start} value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      {!start && <p className="-mt-1 text-xs text-muted-foreground">{t("allDay")}</p>}
      <Field id="ev-remind" label={t("remindBefore")}>
        <select id="ev-remind" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={remind} onChange={(e) => setRemind(e.target.value)}>
          <option value="">{t("noReminder")}</option>
          {start ? (
            <>
              <option value="0">{t("minutesBefore", { n: 0 })}</option>
              <option value="15">{t("minutesBefore", { n: 15 })}</option>
              <option value="30">{t("minutesBefore", { n: 30 })}</option>
              <option value="60">{t("hourBefore")}</option>
            </>
          ) : (
            <option value="0">{t("dayBefore")}</option>
          )}
        </select>
      </Field>
      <Field id="ev-notes" label={t("notes")}>
        <Textarea id="ev-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 size-4" checked={google} onChange={(e) => setGoogle(e.target.checked)} />
        <span>{t("syncGoogle")}<span className="block text-xs text-muted-foreground">{t("syncGoogleHint")}</span></span>
      </label>
      {event.id && (
        <ConfirmDelete name={title || t("event")} onConfirm={del}>
          <Button type="button" variant="ghost" className="text-destructive">{t("delete")}</Button>
        </ConfirmDelete>
      )}
    </FormDialog>
  );
}
