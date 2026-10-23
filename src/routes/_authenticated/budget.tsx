import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { formatMoney, todayISO, useRows, useTableMutations } from "@/lib/data";
import { PageHeader, Empty } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/budget")({
  head: () => ({ meta: [{ title: "Budget — Nest" }, { name: "description", content: "Track your income and expenses." }] }),
  component: Budget,
});

function Budget() {
  const { t, lang } = useLang();
  const { data: rows = [] } = useRows("transactions");
  const { add, remove } = useTableMutations("transactions");
  const cats = t("cats").split(",");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState(cats[0]);
  const [date, setDate] = useState(todayISO());

  const month = todayISO().slice(0, 7);
  const monthRows = rows.filter((r) => r.occurred_on.startsWith(month));
  const earned = monthRows.filter((r) => r.kind === "income").reduce((s, r) => s + Number(r.amount), 0);
  const spent = monthRows.filter((r) => r.kind === "expense").reduce((s, r) => s + Number(r.amount), 0);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title || !amount) return;
    add.mutate({ title, amount: Number(amount), kind, category, occurred_on: date });
    setTitle("");
    setAmount("");
  }

  return (
    <>
      <PageHeader title={t("budget")} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t("balance")} value={formatMoney(earned - spent, lang)} strong />
        <Stat label={t("earned")} value={formatMoney(earned, lang)} />
        <Stat label={t("spent")} value={formatMoney(spent, lang)} />
      </div>

      <form onSubmit={submit} className="card-soft mb-6 grid gap-3 p-5 sm:grid-cols-6">
        <div className="flex rounded-full bg-muted p-1 sm:col-span-6 sm:w-fit">
          {(["expense", "income"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className={`rounded-full px-4 py-1.5 text-sm ${kind === k ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
              {t(k)}
            </button>
          ))}
        </div>
        <Input className="sm:col-span-2" placeholder={t("title")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input type="number" step="0.01" placeholder={t("amount")} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button type="submit" className="rounded-full">{t("add")}</Button>
      </form>

      {rows.length === 0 ? <Empty text={t("empty")} /> : (
        <ul className="card-soft divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex-1">
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-muted-foreground">{r.category} · {r.occurred_on}</div>
              </div>
              <div className={r.kind === "income" ? "font-medium text-success" : "font-medium"}>
                {r.kind === "income" ? "+" : "−"}{formatMoney(Number(r.amount), lang)}
              </div>
              <button aria-label={t("delete")} onClick={() => remove.mutate(r.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "rounded-2xl bg-primary p-5 text-primary-foreground" : "card-soft p-5"}>
      <div className="text-sm opacity-75">{label}</div>
      <div className="mt-2 font-display text-3xl">{value}</div>
    </div>
  );
}
