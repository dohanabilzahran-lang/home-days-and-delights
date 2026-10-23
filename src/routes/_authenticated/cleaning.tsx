import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useLang } from "@/lib/i18n";
import { daysUntilDue, todayISO, useRows, useTableMutations } from "@/lib/data";
import { PageHeader, Empty } from "@/components/PageHeader";
import { CheckRow } from "@/components/CheckRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/cleaning")({
  head: () => ({ meta: [{ title: "Cleaning — Nest" }, { name: "description", content: "Your house cleaning schedule." }] }),
  component: Cleaning,
});

function Cleaning() {
  const { t } = useLang();
  const { data: rows = [] } = useRows("cleaning_tasks");
  const { add, update, remove } = useTableMutations("cleaning_tasks");
  const today = todayISO();
  const [title, setTitle] = useState("");
  const [room, setRoom] = useState("");
  const [every, setEvery] = useState("7");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title) return;
    add.mutate({ title, room: room || null, every_days: Math.max(1, Number(every) || 7) });
    setTitle("");
    setRoom("");
  }

  const sorted = [...rows].sort((a, b) => daysUntilDue(a.last_done, a.every_days, today) - daysUntilDue(b.last_done, b.every_days, today));

  return (
    <>
      <PageHeader title={t("cleaning")} />
      <form onSubmit={submit} className="card-soft mb-6 grid gap-3 p-5 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <Input placeholder={t("title")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder={t("room")} value={room} onChange={(e) => setRoom(e.target.value)} />
        <Input type="number" min={1} aria-label={t("everyDays")} placeholder={t("everyDays")} value={every} onChange={(e) => setEvery(e.target.value)} />
        <Button type="submit" className="rounded-full">{t("add")}</Button>
      </form>
      {sorted.length === 0 ? <Empty text={t("empty")} /> : (
        <ul className="card-soft divide-y divide-border">
          {sorted.map((r) => {
            const d = daysUntilDue(r.last_done, r.every_days, today);
            const doneToday = r.last_done === today;
            const label = d < 0 ? t("overdue") : d === 0 ? t("due") : t("dueIn", { n: d });
            return (
              <CheckRow key={r.id} title={r.title} done={doneToday}
                meta={[r.room, `${t("everyDays").replace(/\s*\(.*\)/, "")} ${r.every_days}`].filter(Boolean).join(" · ")}
                right={!doneToday && (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs ${d <= 0 ? "bg-destructive/15 text-destructive" : "bg-secondary"}`}>{label}</span>
                )}
                onToggle={() => update.mutate({ id: r.id, values: { last_done: doneToday ? null : today } })}
                onDelete={() => remove.mutate(r.id)} />
            );
          })}
        </ul>
      )}
    </>
  );
}
