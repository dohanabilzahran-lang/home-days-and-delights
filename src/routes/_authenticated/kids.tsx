import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useLang } from "@/lib/i18n";
import { todayISO, useRows, useTableMutations, useToggleDone } from "@/lib/data";
import { PageHeader, ListState } from "@/components/PageHeader";
import { CheckRow } from "@/components/CheckRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/kids")({
  head: () => ({ meta: [{ title: "Kids — Nest" }, { name: "description", content: "Your kids' daily routine." }] }),
  component: Kids,
});

function Kids() {
  const { t } = useLang();
  const query = useRows("kids_tasks");
  const rows = query.data ?? [];
  const { add, remove } = useTableMutations("kids_tasks");
  const toggleDone = useToggleDone("kids_tasks");
  const today = todayISO();
  const [child, setChild] = useState("");
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!child || !title) return;
    add.mutate({ child_name: child, title, at_time: time || null });
    setTitle("");
    setTime("");
  }

  const children = [...new Set(rows.map((r) => r.child_name))];

  return (
    <>
      <PageHeader title={t("kids")} />
      <form onSubmit={submit} className="card-soft mb-6 grid gap-3 p-5 sm:grid-cols-[1fr_2fr_1fr_auto]">
        <Input list="kids-names" placeholder={t("child")} value={child} onChange={(e) => setChild(e.target.value)} />
        <datalist id="kids-names">{children.map((c) => <option key={c} value={c} />)}</datalist>
        <Input placeholder={t("title")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input type="time" aria-label={t("time")} value={time} onChange={(e) => setTime(e.target.value)} />
        <Button type="submit" className="rounded-full">{t("add")}</Button>
      </form>
      <ListState query={query} isEmpty={children.length === 0}>
        <div className="grid gap-6 md:grid-cols-2">
          {children.map((c) => (
            <section key={c}>
              <h2 className="mb-3 text-2xl">{c}</h2>
              <ul className="card-soft divide-y divide-border">
                {rows.filter((r) => r.child_name === c).map((r) => (
                  <CheckRow key={r.id} title={r.title} meta={r.at_time?.slice(0, 5)}
                    done={r.last_done === today}
                    onToggle={() => toggleDone(r, today)}
                    onDelete={() => remove.mutate(r.id)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </ListState>
    </>
  );
}
