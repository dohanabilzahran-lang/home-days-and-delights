import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Sun, Moon } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { todayISO, useHistory, useRoutineActions, useRows, useTableMutations, type Row } from "@/lib/data";
import { addDays, dailyStatus } from "@/lib/recurrence";
import { PageHeader, ListState } from "@/components/PageHeader";
import { CheckRow, Pill } from "@/components/CheckRow";
import { FormDialog, Field } from "@/components/FormDialog";
import { HistoryList, WeekdayPicker, useScheduleLabel } from "@/components/RoutineBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/skincare")({
  head: () => ({ meta: [{ title: "Skincare — Nest" }, { name: "description", content: "Your morning and evening skincare routine." }] }),
  component: Skincare,
});

type Step = Row<"skincare_steps">;

function Skincare() {
  const { t } = useLang();
  const scheduleLabel = useScheduleLabel();
  const query = useRows("skincare_steps");
  const rows = query.data ?? [];
  const history = useHistory("skincare").data;
  const { add, update, remove } = useTableMutations("skincare_steps");
  const act = useRoutineActions("skincare");
  const today = todayISO();
  const [editing, setEditing] = useState<Step | null>(null);

  return (
    <>
      <PageHeader title={t("skincare")} />
      <div className="grid gap-6 md:grid-cols-2">
        {(["morning", "evening"] as const).map((period) => {
          const list = rows.filter((r) => r.period === period);
          return (
            <section key={period}>
              <h2 className="mb-3 flex items-center gap-2 text-2xl">
                {period === "morning" ? <Sun className="size-5" /> : <Moon className="size-5" />} {t(period)}
              </h2>
              <AddStep onAdd={(title, product) => add.mutate({ title, product, period, position: list.length })} />
              <ListState query={query} isEmpty={list.length === 0}>
                <ul className="card-soft divide-y divide-border">
                  {list.map((r) => {
                    const status = dailyStatus(r, history, today);
                    return (
                      <CheckRow key={r.id} title={r.title}
                        meta={[r.product, r.remind_time?.slice(0, 5), scheduleLabel(r.days_of_week)].filter(Boolean).join(" · ")}
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
                        ] : []}
                        onEdit={() => setEditing(r)}
                        onDelete={() => remove.mutate(r.id)} />
                    );
                  })}
                </ul>
              </ListState>
            </section>
          );
        })}
      </div>
      {editing && (
        <EditStep key={editing.id} step={editing} history={history} onClose={() => setEditing(null)}
          onSave={(values) => update.mutate({ id: editing.id, values }, { onSuccess: () => setEditing(null) })} />
      )}
    </>
  );
}

function EditStep({ step, history, onClose, onSave }: {
  step: Step;
  history: Row<"completions">[];
  onClose: () => void;
  onSave: (v: {
    title: string; product: string | null; period: string; days_of_week: number[] | null; remind_time: string | null; show_in_calendar: boolean;
  }) => void;
}) {
  const { t } = useLang();
  const [title, setTitle] = useState(step.title);
  const [product, setProduct] = useState(step.product ?? "");
  const [period, setPeriod] = useState(step.period);
  const [days, setDays] = useState<number[]>(step.days_of_week ?? []);
  const [remindTime, setRemindTime] = useState(step.remind_time?.slice(0, 5) ?? "");
  const [inCalendar, setInCalendar] = useState(step.show_in_calendar);
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("edit")}
      onSubmit={() => title.trim() && onSave({
        title: title.trim(), product: product.trim() || null, period,
        days_of_week: days.length ? days : null, remind_time: remindTime || null, show_in_calendar: inCalendar,
      })}>
      <Field id="edit-step-title" label={t("step")}>
        <Input id="edit-step-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field id="edit-step-product" label={t("product")}>
        <Input id="edit-step-product" value={product} onChange={(e) => setProduct(e.target.value)} />
      </Field>
      <Field id="edit-step-period" label={t("time")}>
        <select id="edit-step-period" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="morning">{t("morning")}</option>
          <option value="evening">{t("evening")}</option>
        </select>
      </Field>
      <WeekdayPicker value={days} onChange={setDays} />
      <Field id="edit-step-remind" label={t("reminderTime")}>
        <Input id="edit-step-remind" type="time" value={remindTime} onChange={(e) => setRemindTime(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4" checked={inCalendar} onChange={(e) => setInCalendar(e.target.checked)} />
        {t("showInCalendar")}
      </label>
      <HistoryList history={history} sourceId={step.id} />
    </FormDialog>
  );
}

function AddStep({ onAdd }: { onAdd: (title: string, product: string | null) => void }) {
  const { t } = useLang();
  const [title, setTitle] = useState("");
  const [product, setProduct] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), product.trim() || null);
    setTitle("");
    setProduct("");
  }
  return (
    <form onSubmit={submit} className="mb-3 flex gap-2">
      <Input aria-label={t("step")} placeholder={t("step")} value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input aria-label={t("product")} placeholder={t("product")} value={product} onChange={(e) => setProduct(e.target.value)} />
      <Button type="submit" className="rounded-full">{t("add")}</Button>
    </form>
  );
}
