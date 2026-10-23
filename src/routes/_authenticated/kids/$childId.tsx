import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { todayISO, useHistory, useRoutineActions, useRows, useTableMutations, type Row } from "@/lib/data";
import { addDays, dailyStatus } from "@/lib/recurrence";
import { PageHeader, ListState } from "@/components/PageHeader";
import { CheckRow, Pill } from "@/components/CheckRow";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { FormDialog, Field } from "@/components/FormDialog";
import { HistoryList, WeekdayPicker, useScheduleLabel } from "@/components/RoutineBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/kids/$childId")({
  head: () => ({ meta: [{ title: "Kids — Nest" }, { name: "description", content: "A child's daily routine." }] }),
  component: ChildPage,
});

type Item = Row<"kids_tasks">;
const order = { due: 0, done: 1, postponed: 2, skipped: 3, off: 4 } as const;

function ChildPage() {
  const { childId } = Route.useParams();
  const { t } = useLang();
  const navigate = useNavigate();
  const scheduleLabel = useScheduleLabel();
  const childrenQuery = useRows("children");
  const child = childrenQuery.data?.find((c) => c.id === childId);
  const query = useRows("kids_tasks");
  const history = useHistory("kids").data;
  const today = todayISO();
  const tasks = (query.data ?? [])
    .filter((k) => k.child_id === childId)
    .map((k) => ({ item: k, status: dailyStatus(k, history, today) }))
    .sort((a, b) => order[a.status] - order[b.status] || (a.item.at_time ?? "99").localeCompare(b.item.at_time ?? "99"));
  const { add, update, remove } = useTableMutations("kids_tasks");
  const childMut = useTableMutations("children");
  const act = useRoutineActions("kids");
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [editing, setEditing] = useState<Item | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    add.mutate({ child_id: childId, title: title.trim(), at_time: time || null, days_of_week: days.length ? days : null });
    setTitle("");
    setTime("");
  }

  if (childrenQuery.isSuccess && !child) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  return (
    <>
      <BackLink />
      <PageHeader title={child?.name ?? "…"} subtitle={t("routine")}>
        {child && (
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => { setNewName(child.name); setRenaming(true); }}>
              <Pencil className="size-4" /> {t("edit")}
            </Button>
            {tasks.length > 0 ? (
              <Button variant="outline" className="rounded-full text-muted-foreground" onClick={() => toast(t("childInUse"))}
                aria-label={t("deleteLabel", { name: child.name })}>
                <Trash2 className="size-4" />
              </Button>
            ) : (
              <ConfirmDelete name={child.name}
                onConfirm={() => childMut.remove.mutate(child.id, { onSuccess: () => navigate({ to: "/kids" }) })}>
                <Button variant="outline" className="rounded-full text-destructive" aria-label={t("deleteLabel", { name: child.name })}>
                  <Trash2 className="size-4" />
                </Button>
              </ConfirmDelete>
            )}
          </div>
        )}
      </PageHeader>

      <form onSubmit={submit} className="card-soft mb-6 grid gap-3 p-5 sm:grid-cols-[2fr_1fr_auto]">
        <Input aria-label={t("title")} placeholder={t("title")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input type="time" aria-label={t("time")} value={time} onChange={(e) => setTime(e.target.value)} />
        <Button type="submit" className="rounded-full">{t("add")}</Button>
        <div className="sm:col-span-3"><WeekdayPicker value={days} onChange={setDays} /></div>
      </form>

      <ListState query={query} isEmpty={tasks.length === 0}>
        <ul className="card-soft divide-y divide-border">
          {tasks.map(({ item: r, status }) => (
            <CheckRow key={r.id} title={r.title}
              meta={[r.at_time?.slice(0, 5), scheduleLabel(r.days_of_week)].filter(Boolean).join(" · ")}
              done={status === "done"}
              muted={status === "off" || status === "skipped" || status === "postponed"}
              right={
                status === "skipped" ? <Pill>{t("skipped")}</Pill>
                : status === "postponed" ? <Pill>{t("postponedTo", { date: r.snoozed_until ?? "" })}</Pill>
                : status === "off" ? <Pill>{t("notToday")}</Pill>
                : null
              }
              onToggle={() => (status === "done" ? act.uncomplete(r.id, today) : act.complete(r.id, today))}
              actions={status === "due" ? [
                { label: t("skip"), onSelect: () => act.skip(r.id, today) },
                { label: t("postponeTomorrow"), onSelect: () => act.postpone(r.id, addDays(today, 1)) },
              ] : status === "skipped" ? [
                { label: t("markDoneLabel", { name: r.title }), onSelect: () => act.complete(r.id, today) },
              ] : []}
              onEdit={() => setEditing(r)}
              onDelete={() => remove.mutate(r.id)} />
          ))}
        </ul>
      </ListState>

      {editing && (
        <EditKidTask key={editing.id} task={editing} history={history} onClose={() => setEditing(null)}
          onSave={(values) => update.mutate({ id: editing.id, values }, { onSuccess: () => setEditing(null) })} />
      )}

      <FormDialog open={renaming} onOpenChange={setRenaming} title={t("edit")}
        onSubmit={() => {
          const n = newName.trim();
          if (child && n) childMut.update.mutate({ id: child.id, values: { name: n } }, { onSuccess: () => setRenaming(false) });
        }}>
        <Field id="rename-child" label={t("childName")}>
          <Input id="rename-child" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </Field>
      </FormDialog>
    </>
  );
}

function BackLink() {
  const { t } = useLang();
  return (
    <Link to="/kids" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4 rtl:rotate-180" /> {t("backToKids")}
    </Link>
  );
}

function EditKidTask({ task, history, onClose, onSave }: {
  task: Item;
  history: Row<"completions">[];
  onClose: () => void;
  onSave: (v: { title: string; at_time: string | null; days_of_week: number[] | null; remind: boolean; show_in_calendar: boolean }) => void;
}) {
  const { t } = useLang();
  const [title, setTitle] = useState(task.title);
  const [time, setTime] = useState(task.at_time?.slice(0, 5) ?? "");
  const [days, setDays] = useState<number[]>(task.days_of_week ?? []);
  const [remind, setRemind] = useState(task.remind);
  const [inCalendar, setInCalendar] = useState(task.show_in_calendar);
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("edit")}
      onSubmit={() => title.trim() && onSave({
        title: title.trim(), at_time: time || null, days_of_week: days.length ? days : null, remind: remind && !!time, show_in_calendar: inCalendar,
      })}>
      <Field id="edit-kid-title" label={t("title")}>
        <Input id="edit-kid-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field id="edit-kid-time" label={t("time")}>
        <Input id="edit-kid-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>
      <WeekdayPicker value={days} onChange={setDays} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4" checked={remind} disabled={!time} onChange={(e) => setRemind(e.target.checked)} />
        {t("remindMe")}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4" checked={inCalendar} onChange={(e) => setInCalendar(e.target.checked)} />
        {t("showInCalendar")}
      </label>
      <HistoryList history={history} sourceId={task.id} />
    </FormDialog>
  );
}
