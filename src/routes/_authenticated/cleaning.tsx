import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { todayISO, useHistory, useRoutineActions, useRows, useTableMutations, type Row } from "@/lib/data";
import { addDays, diffDays, handledDate, nextDueInterval } from "@/lib/recurrence";
import { PageHeader, ListState } from "@/components/PageHeader";
import { CheckRow, Pill } from "@/components/CheckRow";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { FormDialog, Field } from "@/components/FormDialog";
import { HistoryList } from "@/components/RoutineBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/cleaning")({
  head: () => ({ meta: [{ title: "Cleaning — Nest" }, { name: "description", content: "Your house cleaning schedule, room by room." }] }),
  component: Cleaning,
});

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

type Task = Row<"cleaning_tasks">;

function Cleaning() {
  const { t } = useLang();
  const query = useRows("cleaning_tasks");
  const rows = query.data ?? [];
  const rooms = useRows("rooms").data ?? [];
  const history = useHistory("cleaning").data;
  const { add, update, remove } = useTableMutations("cleaning_tasks");
  const act = useRoutineActions("cleaning");
  const today = todayISO();
  const [title, setTitle] = useState("");
  const [roomId, setRoomId] = useState("");
  const [every, setEvery] = useState("7");
  const [editing, setEditing] = useState<Task | null>(null);
  const [roomsOpen, setRoomsOpen] = useState(false);
  // Checklist ticks are kept only until the task is completed.
  const [ticked, setTicked] = useState<Record<string, number[]>>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    add.mutate({ title: title.trim(), room_id: roomId || null, every_days: Math.max(1, Number(every) || 7) });
    setTitle("");
  }

  const info = (r: Task) => {
    const next = nextDueInterval(handledDate(history, r.id, r.last_done), r.every_days, r.snoozed_until, today);
    const doneToday = history.some((c) => c.source_id === r.id && c.on_date === today && c.status === "done");
    return { next, days: diffDays(today, next), doneToday, upToDate: doneToday || diffDays(today, next) > 0 };
  };

  const complete = (r: Task) => {
    act.complete(r.id, today);
    setTicked((s) => ({ ...s, [r.id]: [] }));
  };

  const sections = [
    ...rooms.map((room) => ({ id: room.id, name: room.name, tasks: rows.filter((r) => r.room_id === room.id) })),
    { id: "", name: t("noRoom"), tasks: rows.filter((r) => !r.room_id || !rooms.some((room) => room.id === r.room_id)) },
  ]
    .filter((s) => s.tasks.length > 0)
    .map((s) => ({ ...s, tasks: [...s.tasks].sort((a, b) => info(a).days - info(b).days) }));

  const upToDateAll = rows.filter((r) => info(r).upToDate).length;
  const homePct = rows.length ? Math.round((upToDateAll / rows.length) * 100) : 100;

  return (
    <>
      <PageHeader title={t("cleaning")} subtitle={rows.length ? t("homeProgress", { p: homePct }) : undefined}>
        <Button variant="outline" className="rounded-full" onClick={() => setRoomsOpen(true)}>
          <Settings2 className="size-4" /> {t("manageRooms")}
        </Button>
      </PageHeader>
      {rows.length > 0 && <Progress value={homePct} className="-mt-5 mb-8 h-2" aria-label={t("homeProgress", { p: homePct })} />}

      <form onSubmit={submit} className="card-soft mb-6 grid gap-3 p-5 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <Input aria-label={t("title")} placeholder={t("title")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <select aria-label={t("room")} className={selectClass} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          <option value="">{t("noRoom")}</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <Input type="number" min={1} aria-label={t("everyDays")} placeholder={t("everyDays")} value={every} onChange={(e) => setEvery(e.target.value)} />
        <Button type="submit" className="rounded-full">{t("add")}</Button>
      </form>
      {rooms.length === 0 && !query.isPending && (
        <p className="-mt-3 mb-6 text-sm text-muted-foreground">{t("addRoomFirst")}</p>
      )}

      <ListState query={query} isEmpty={rows.length === 0}>
        <div className="space-y-6">
          {sections.map((s) => {
            const ok = s.tasks.filter((r) => info(r).upToDate).length;
            return (
              <section key={s.id || "none"}>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="text-2xl">{s.name}</h2>
                  <span className="text-sm text-muted-foreground">{t("upToDate", { a: ok, b: s.tasks.length })}</span>
                </div>
                <ul className="card-soft divide-y divide-border">
                  {s.tasks.map((r) => {
                    const { next, days, doneToday } = info(r);
                    const postponed = !!r.snoozed_until && r.snoozed_until === next && days > 0;
                    const pill = doneToday ? null
                      : postponed ? <Pill>{t("postponedTo", { date: next })}</Pill>
                      : days < 0 ? <Pill tone="warn">{t("overdue")}</Pill>
                      : days === 0 ? <Pill tone="warn">{t("due")}</Pill>
                      : <Pill>{t("dueIn", { n: days })}</Pill>;
                    const marks = ticked[r.id] ?? [];
                    return (
                      <CheckRow key={r.id} title={r.title} done={doneToday}
                        meta={t("everyNDays", { n: r.every_days })}
                        right={pill}
                        onToggle={() => (doneToday ? act.uncomplete(r.id, today) : complete(r))}
                        actions={doneToday ? [] : [
                          { label: t("skip"), onSelect: () => act.skip(r.id, today) },
                          { label: t("postponeTomorrow"), onSelect: () => act.postpone(r.id, addDays(today, 1)) },
                          { label: t("postpone3"), onSelect: () => act.postpone(r.id, addDays(today, 3)) },
                        ]}
                        onEdit={() => setEditing(r)}
                        onDelete={() => remove.mutate(r.id)}>
                        {r.checklist.length > 0 && !doneToday && days <= 0 && (
                          <ul className="mt-2 space-y-1">
                            <li className="text-xs text-muted-foreground">{t("steps_n", { a: marks.length, b: r.checklist.length })}</li>
                            {r.checklist.map((step, i) => (
                              <li key={i}>
                                <label className="flex items-center gap-2 text-sm">
                                  <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={marks.includes(i)}
                                    onChange={() => {
                                      const nextMarks = marks.includes(i) ? marks.filter((x) => x !== i) : [...marks, i];
                                      setTicked((st) => ({ ...st, [r.id]: nextMarks }));
                                      if (nextMarks.length === r.checklist.length) complete(r);
                                    }} />
                                  {step}
                                </label>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CheckRow>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </ListState>

      {editing && (
        <EditTask
          key={editing.id}
          task={editing}
          rooms={rooms}
          history={history}
          onClose={() => setEditing(null)}
          onSave={(values) => update.mutate({ id: editing.id, values }, { onSuccess: () => setEditing(null) })}
        />
      )}
      <RoomsDialog open={roomsOpen} onOpenChange={setRoomsOpen} rooms={rooms} tasks={rows} />
    </>
  );
}

function EditTask({ task, rooms, history, onClose, onSave }: {
  task: Task;
  rooms: Row<"rooms">[];
  history: Row<"completions">[];
  onClose: () => void;
  onSave: (v: { title: string; room_id: string | null; every_days: number; checklist: string[]; show_in_calendar: boolean }) => void;
}) {
  const { t } = useLang();
  const [title, setTitle] = useState(task.title);
  const [roomId, setRoomId] = useState(task.room_id ?? "");
  const [every, setEvery] = useState(String(task.every_days));
  const [checklist, setChecklist] = useState(task.checklist.join("\n"));
  const [inCalendar, setInCalendar] = useState(task.show_in_calendar);
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("edit")}
      onSubmit={() => title.trim() && onSave({
        title: title.trim(),
        room_id: roomId || null,
        every_days: Math.max(1, Number(every) || 7),
        checklist: checklist.split("\n").map((s) => s.trim()).filter(Boolean),
        show_in_calendar: inCalendar,
      })}>
      <Field id="edit-clean-title" label={t("title")}>
        <Input id="edit-clean-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field id="edit-clean-room" label={t("room")}>
        <select id="edit-clean-room" className={selectClass} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          <option value="">{t("noRoom")}</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </Field>
      <Field id="edit-clean-every" label={t("everyDays")}>
        <Input id="edit-clean-every" type="number" min={1} value={every} onChange={(e) => setEvery(e.target.value)} />
      </Field>
      <Field id="edit-clean-checklist" label={t("checklist")}>
        <Textarea id="edit-clean-checklist" rows={4} value={checklist} onChange={(e) => setChecklist(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4" checked={inCalendar} onChange={(e) => setInCalendar(e.target.checked)} />
        {t("showInCalendar")}
      </label>
      <HistoryList history={history} sourceId={task.id} />
    </FormDialog>
  );
}

/** Add, rename and delete rooms. A room with tasks cannot be deleted, so no task loses its room by accident. */
function RoomsDialog({ open, onOpenChange, rooms, tasks }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rooms: Row<"rooms">[];
  tasks: Row<"cleaning_tasks">[];
}) {
  const { t } = useLang();
  const { add, update, remove } = useTableMutations("rooms");
  const [name, setName] = useState("");

  function addRoom() {
    const n = name.trim();
    if (!n) return;
    add.mutate({ name: n, position: rooms.length }, { onSuccess: () => setName("") });
  }

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={t("rooms")} onSubmit={addRoom} submitLabel={t("newRoom")}>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {rooms.map((room) => {
          const count = tasks.filter((x) => x.room_id === room.id).length;
          return (
            <li key={room.id} className="flex items-center gap-2 px-3 py-2">
              <Input
                aria-label={t("name")}
                defaultValue={room.name}
                className="flex-1"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== room.name) update.mutate({ id: room.id, values: { name: v } });
                  else e.target.value = room.name;
                }}
              />
              <span className="shrink-0 text-xs text-muted-foreground">{t("roomTasks", { n: count })}</span>
              {count > 0 ? (
                <button type="button" aria-label={t("deleteLabel", { name: room.name })} onClick={() => toast(t("roomInUse"))}
                  className="text-muted-foreground opacity-50">
                  <Trash2 className="size-4" />
                </button>
              ) : (
                <ConfirmDelete name={room.name} onConfirm={() => remove.mutate(room.id)}>
                  <button type="button" aria-label={t("deleteLabel", { name: room.name })} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                </ConfirmDelete>
              )}
            </li>
          );
        })}
      </ul>
      <Field id="new-room" label={t("newRoom")}>
        <Input id="new-room" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
    </FormDialog>
  );
}
