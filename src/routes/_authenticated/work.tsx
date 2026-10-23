import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Pencil, Plus, StickyNote, Trash2 } from "lucide-react";
import { useLang, type Key } from "@/lib/i18n";
import { todayISO, useRows, useTableMutations, type Row } from "@/lib/data";
import { PageHeader, ListState } from "@/components/PageHeader";
import { CheckRow, Pill } from "@/components/CheckRow";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { FormDialog, Field } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/work")({
  head: () => ({ meta: [{ title: "Work — Nest" }, { name: "description", content: "Work tasks, notes, reminders, deadlines and projects." }] }),
  component: Work,
});

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
type Item = Row<"work_items">;
type Kind = "task" | "note" | "reminder";
type Status = "todo" | "doing" | "done";
type Priority = "low" | "normal" | "high";
const STATUSES: Status[] = ["todo", "doing", "done"];
const priorityRank: Record<string, number> = { high: 0, normal: 1, low: 2 };

function Work() {
  const { t } = useLang();
  const query = useRows("work_items");
  const items = query.data ?? [];
  const projects = (useRows("work_projects").data ?? []).filter((p) => !p.archived);
  const { add, update, remove } = useTableMutations("work_items");
  const projectMut = useTableMutations("work_projects");
  const events = useRows("events").data ?? [];
  const qc = useQueryClient();

  /**
   * "Also add to Google Calendar" on a dated task keeps one linked event (events.work_item_id is unique).
   * Turning it off removes the event; one already in Google is hidden until sync removes it there.
   */
  async function syncLinkedEvent(item: Item, v: { title: string; due_date: string | null; due_time: string | null }, wanted: boolean) {
    const linked = events.find((e) => e.work_item_id === item.id && !e.deleted_at);
    let error = null;
    if (wanted && v.due_date) {
      const values = { work_item_id: item.id, title: v.title, starts_on: v.due_date, start_time: v.due_time, sync_to_google: true, sync_state: "pending", updated_at: new Date().toISOString() };
      ({ error } = linked
        ? await supabase.from("events").update(values).eq("id", linked.id)
        : await supabase.from("events").insert(values));
    } else if (linked) {
      ({ error } = linked.google_event_id
        ? await supabase.from("events").update({ deleted_at: new Date().toISOString(), sync_state: "delete_requested_by_nest" }).eq("id", linked.id)
        : await supabase.from("events").delete().eq("id", linked.id));
    }
    if (error) toast.error(t("saveFailed"), { description: error.message });
    qc.invalidateQueries({ queryKey: ["events"] });
  }
  const today = todayISO();
  const [filter, setFilter] = useState<string>("all");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Kind>("task");
  const [editing, setEditing] = useState<Item | null>(null);
  const [newProject, setNewProject] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    add.mutate({ title: title.trim(), kind, project_id: filter !== "all" && filter !== "none" ? filter : null });
    setTitle("");
  }

  const visible = items.filter((i) =>
    filter === "all" ? true : filter === "none" ? !i.project_id : i.project_id === filter);
  const notes = visible.filter((i) => i.kind === "note");
  const tasks = visible.filter((i) => i.kind !== "note");
  const sortTasks = (a: Item, b: Item) =>
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1);

  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name;

  return (
    <>
      <PageHeader title={t("work")} />

      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label={t("projects")}>
        {[{ id: "all", name: t("allProjects") }, ...projects.map((p) => ({ id: p.id, name: p.name })), { id: "none", name: t("noProject") }].map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={filter === p.id} onClick={() => setFilter(p.id)}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${filter === p.id ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
            {p.name}
          </button>
        ))}
        <button type="button" onClick={() => setNewProject("")} className="flex items-center gap-1 rounded-full border border-dashed border-border px-3.5 py-1.5 text-sm text-muted-foreground">
          <Plus className="size-3.5" /> {t("newProject")}
        </button>
      </div>

      <form onSubmit={submit} className="card-soft mb-6 grid gap-3 p-5 sm:grid-cols-[1fr_auto_auto]">
        <Input aria-label={t("title")} placeholder={t("title")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <select aria-label={t("type")} className={selectClass} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          {(["task", "reminder", "note"] as const).map((k) => <option key={k} value={k}>{t(`kind_${k}` as Key)}</option>)}
        </select>
        <Button type="submit" className="rounded-full">{t("add")}</Button>
      </form>

      <ListState query={query} isEmpty={visible.length === 0}>
        <div className="space-y-6">
          {STATUSES.map((status) => {
            const list = tasks.filter((i) => i.status === status).sort(sortTasks);
            if (list.length === 0) return null;
            return (
              <section key={status}>
                <h2 className="mb-3 text-2xl">{t(`status_${status}` as Key)} <span className="text-base text-muted-foreground">· {list.length}</span></h2>
                <ul className="card-soft divide-y divide-border">
                  {list.map((i) => {
                    const overdue = i.due_date && i.due_date < today && i.status !== "done";
                    const dueToday = i.due_date === today && i.status !== "done";
                    return (
                      <CheckRow key={i.id} title={i.title} done={i.status === "done"}
                        meta={[
                          i.kind === "reminder" ? t("kind_reminder") : null,
                          filter === "all" ? projectName(i.project_id) : null,
                          i.due_date ? `${t("deadline")}: ${i.due_date}${i.due_time ? ` ${i.due_time.slice(0, 5)}` : ""}` : null,
                        ].filter(Boolean).join(" · ")}
                        right={
                          <>
                            {overdue && <Pill tone="warn">{t("overdueSince", { date: i.due_date ?? "" })}</Pill>}
                            {dueToday && <Pill tone="warn">{t("dueToday")}</Pill>}
                            {i.priority === "high" && i.status !== "done" && <Pill>{t("priority_high")}</Pill>}
                          </>
                        }
                        onToggle={() => update.mutate({ id: i.id, values: { status: i.status === "done" ? "todo" : "done", updated_at: new Date().toISOString() } })}
                        actions={STATUSES.filter((s) => s !== i.status).map((s) => ({
                          label: t(`status_${s}` as Key),
                          onSelect: () => update.mutate({ id: i.id, values: { status: s, updated_at: new Date().toISOString() } }),
                        }))}
                        onEdit={() => setEditing(i)}
                        onDelete={() => remove.mutate(i.id)} />
                    );
                  })}
                </ul>
              </section>
            );
          })}

          {notes.length > 0 && (
            <section>
              <h2 className="mb-3 text-2xl">{t("notes")}</h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {notes.map((n) => (
                  <li key={n.id} className="card-soft space-y-2 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-lg"><StickyNote className="size-4 text-muted-foreground" />{n.title}</h3>
                      <div className="flex gap-2.5">
                        <button type="button" aria-label={t("editLabel", { name: n.title })} onClick={() => setEditing(n)} className="text-muted-foreground"><Pencil className="size-4" /></button>
                        <ConfirmDelete name={n.title} onConfirm={() => remove.mutate(n.id)}>
                          <button type="button" aria-label={t("deleteLabel", { name: n.title })} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
                        </ConfirmDelete>
                      </div>
                    </div>
                    {n.body && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{n.body}</p>}
                    {filter === "all" && projectName(n.project_id) && <div className="text-xs text-muted-foreground">{projectName(n.project_id)}</div>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </ListState>

      {editing && (
        <EditItem key={editing.id} item={editing} projects={projects}
          inGoogle={events.some((e) => e.work_item_id === editing.id && !e.deleted_at)}
          onClose={() => setEditing(null)}
          onSave={({ sync_google, ...values }) => update.mutate(
            { id: editing.id, values: { ...values, updated_at: new Date().toISOString() } },
            { onSuccess: () => { syncLinkedEvent(editing, values, sync_google); setEditing(null); } },
          )} />
      )}

      <FormDialog open={newProject !== null} onOpenChange={(o) => !o && setNewProject(null)} title={t("newProject")}
        onSubmit={() => {
          const n = newProject?.trim();
          if (n) projectMut.add.mutate({ name: n }, { onSuccess: () => setNewProject(null) });
        }}>
        <Field id="new-project" label={t("name")}>
          <Input id="new-project" value={newProject ?? ""} onChange={(e) => setNewProject(e.target.value)} />
        </Field>
      </FormDialog>
    </>
  );
}

function EditItem({ item, projects, inGoogle, onClose, onSave }: {
  item: Item;
  projects: Row<"work_projects">[];
  inGoogle: boolean;
  onClose: () => void;
  onSave: (v: {
    title: string; body: string; kind: Kind; status: Status; priority: Priority; project_id: string | null;
    due_date: string | null; due_time: string | null; remind: boolean; show_in_calendar: boolean; sync_google: boolean;
  }) => void;
}) {
  const { t } = useLang();
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  const [kind, setKind] = useState<Kind>(item.kind as Kind);
  const [status, setStatus] = useState<Status>(item.status as Status);
  const [priority, setPriority] = useState<Priority>(item.priority as Priority);
  const [projectId, setProjectId] = useState(item.project_id ?? "");
  const [dueDate, setDueDate] = useState(item.due_date ?? "");
  const [dueTime, setDueTime] = useState(item.due_time?.slice(0, 5) ?? "");
  const [remind, setRemind] = useState(item.remind);
  const [inCalendar, setInCalendar] = useState(item.show_in_calendar);
  const [google, setGoogle] = useState(inGoogle);
  const isNote = kind === "note";
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("edit")}
      onSubmit={() => title.trim() && onSave({
        title: title.trim(), body, kind, status, priority, project_id: projectId || null,
        due_date: isNote ? null : dueDate || null, due_time: isNote || !dueDate ? null : dueTime || null,
        remind: !isNote && !!dueDate && remind, show_in_calendar: !isNote && !!dueDate && inCalendar,
        sync_google: !isNote && !!dueDate && google,
      })}>
      <Field id="work-title" label={t("title")}>
        <Input id="work-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="work-kind" label={t("type")}>
          <select id="work-kind" className={selectClass} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            {(["task", "reminder", "note"] as const).map((k) => <option key={k} value={k}>{t(`kind_${k}` as Key)}</option>)}
          </select>
        </Field>
        <Field id="work-project" label={t("project")}>
          <select id="work-project" className={selectClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t("noProject")}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </div>
      {!isNote && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field id="work-status" label={t("status")}>
              <select id="work-status" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                {STATUSES.map((s) => <option key={s} value={s}>{t(`status_${s}` as Key)}</option>)}
              </select>
            </Field>
            <Field id="work-priority" label={t("priority")}>
              <select id="work-priority" className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                {(["high", "normal", "low"] as const).map((p) => <option key={p} value={p}>{t(`priority_${p}` as Key)}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field id="work-due" label={t("deadline")}>
              <Input id="work-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field id="work-time" label={t("time")}>
              <Input id="work-time" type="time" disabled={!dueDate} value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" disabled={!dueDate} checked={remind} onChange={(e) => setRemind(e.target.checked)} />
            {t("remindMe")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" disabled={!dueDate} checked={inCalendar} onChange={(e) => setInCalendar(e.target.checked)} />
            {t("showInCalendar")}
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-4" disabled={!dueDate} checked={google} onChange={(e) => setGoogle(e.target.checked)} />
            <span>{t("syncGoogle")}<span className="block text-xs text-muted-foreground">{t("syncGoogleHint")}</span></span>
          </label>
        </>
      )}
      <Field id="work-body" label={isNote ? t("notes") : t("details")}>
        <Textarea id="work-body" rows={isNote ? 8 : 3} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
    </FormDialog>
  );
}
