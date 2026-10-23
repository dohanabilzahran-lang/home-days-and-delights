import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { daysUntilDue, todayISO, useRows, useTableMutations, useToggleDone, type Row } from "@/lib/data";
import { PageHeader, ListState } from "@/components/PageHeader";
import { CheckRow } from "@/components/CheckRow";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { FormDialog, Field } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/cleaning")({
  head: () => ({ meta: [{ title: "Cleaning — Nest" }, { name: "description", content: "Your house cleaning schedule, room by room." }] }),
  component: Cleaning,
});

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

function Cleaning() {
  const { t } = useLang();
  const query = useRows("cleaning_tasks");
  const rows = query.data ?? [];
  const rooms = useRows("rooms").data ?? [];
  const { add, update, remove } = useTableMutations("cleaning_tasks");
  const toggleDone = useToggleDone("cleaning_tasks");
  const today = todayISO();
  const [title, setTitle] = useState("");
  const [roomId, setRoomId] = useState("");
  const [every, setEvery] = useState("7");
  const [editing, setEditing] = useState<Row<"cleaning_tasks"> | null>(null);
  const [roomsOpen, setRoomsOpen] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    add.mutate({ title: title.trim(), room_id: roomId || null, every_days: Math.max(1, Number(every) || 7) });
    setTitle("");
  }

  const due = (r: Row<"cleaning_tasks">) => daysUntilDue(r.last_done, r.every_days, today);
  // Rooms in their saved order, then tasks without a room.
  const sections = [
    ...rooms.map((room) => ({ id: room.id, name: room.name, tasks: rows.filter((r) => r.room_id === room.id) })),
    { id: "", name: t("noRoom"), tasks: rows.filter((r) => !r.room_id || !rooms.some((room) => room.id === r.room_id)) },
  ]
    .filter((s) => s.tasks.length > 0)
    .map((s) => ({ ...s, tasks: [...s.tasks].sort((a, b) => due(a) - due(b)) }));

  return (
    <>
      <PageHeader title={t("cleaning")}>
        <Button variant="outline" className="rounded-full" onClick={() => setRoomsOpen(true)}>
          <Settings2 className="size-4" /> {t("manageRooms")}
        </Button>
      </PageHeader>

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
            const dueCount = s.tasks.filter((r) => due(r) <= 0 && r.last_done !== today).length;
            return (
              <section key={s.id || "none"}>
                <h2 className="mb-3 flex items-baseline justify-between gap-3 text-2xl">
                  {s.name}
                  {dueCount > 0 && <span className="text-sm text-destructive">{t("tasksDue", { n: dueCount })}</span>}
                </h2>
                <ul className="card-soft divide-y divide-border">
                  {s.tasks.map((r) => {
                    const d = due(r);
                    const doneToday = r.last_done === today;
                    const label = d < 0 ? t("overdue") : d === 0 ? t("due") : t("dueIn", { n: d });
                    return (
                      <CheckRow key={r.id} title={r.title} done={doneToday}
                        meta={`${t("everyDays").replace(/\s*\(.*\)/, "")} ${r.every_days}`}
                        right={!doneToday && (
                          <span className={`rounded-full px-2.5 py-0.5 text-xs ${d <= 0 ? "bg-destructive/15 text-destructive" : "bg-secondary"}`}>{label}</span>
                        )}
                        onToggle={() => toggleDone(r, today)}
                        onEdit={() => setEditing(r)}
                        onDelete={() => remove.mutate(r.id)} />
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
          onClose={() => setEditing(null)}
          onSave={(values) => update.mutate({ id: editing.id, values }, { onSuccess: () => setEditing(null) })}
        />
      )}
      <RoomsDialog open={roomsOpen} onOpenChange={setRoomsOpen} rooms={rooms} tasks={rows} />
    </>
  );
}

function EditTask({ task, rooms, onClose, onSave }: {
  task: Row<"cleaning_tasks">;
  rooms: Row<"rooms">[];
  onClose: () => void;
  onSave: (v: { title: string; room_id: string | null; every_days: number }) => void;
}) {
  const { t } = useLang();
  const [title, setTitle] = useState(task.title);
  const [roomId, setRoomId] = useState(task.room_id ?? "");
  const [every, setEvery] = useState(String(task.every_days));
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("edit")}
      onSubmit={() => title.trim() && onSave({ title: title.trim(), room_id: roomId || null, every_days: Math.max(1, Number(every) || 7) })}>
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
