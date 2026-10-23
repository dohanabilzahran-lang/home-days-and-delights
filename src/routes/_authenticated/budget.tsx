import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useLang, type Key } from "@/lib/i18n";
import { CATEGORY_KEYS, categoryKey, formatMoney, todayISO, useRows, useTableMutations, type CategoryKey, type Row } from "@/lib/data";
import { PageHeader, ListState } from "@/components/PageHeader";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { FormDialog, Field } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/budget")({
  head: () => ({ meta: [{ title: "Budget — Nest" }, { name: "description", content: "Track your income and expenses in EGP." }] }),
  component: Budget,
});

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
type Kind = "expense" | "income";

function useCategoryLabel() {
  const { t } = useLang();
  return (stored: string) => {
    const key = categoryKey(stored);
    return key ? t(`cat_${key}` as Key) : stored;
  };
}

function Budget() {
  const { t, lang } = useLang();
  const label = useCategoryLabel();
  const query = useRows("transactions");
  const rows = query.data ?? [];
  const { add, update, remove } = useTableMutations("transactions");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<Kind>("expense");
  const [category, setCategory] = useState<CategoryKey>("groceries");
  const [date, setDate] = useState(todayISO());
  const [editing, setEditing] = useState<Row<"transactions"> | null>(null);

  const month = todayISO().slice(0, 7);
  const monthRows = rows.filter((r) => r.occurred_on.startsWith(month));
  const earned = monthRows.filter((r) => r.kind === "income").reduce((s, r) => s + Number(r.amount), 0);
  const spent = monthRows.filter((r) => r.kind === "expense").reduce((s, r) => s + Number(r.amount), 0);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !(Number(amount) > 0)) return;
    add.mutate({ title: title.trim(), amount: Number(amount), kind, category, occurred_on: date });
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
        <KindToggle kind={kind} onChange={setKind} />
        <Input className="sm:col-span-2" aria-label={t("title")} placeholder={t("title")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input type="number" step="0.01" min="0.01" aria-label={`${t("amount")} (EGP)`} placeholder={`${t("amount")} (EGP)`} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <CategorySelect aria-label={t("category")} value={category} onChange={setCategory} />
        <Input type="date" aria-label={t("date")} value={date} onChange={(e) => setDate(e.target.value)} />
        <Button type="submit" className="rounded-full">{t("add")}</Button>
      </form>

      <ListState query={query} isEmpty={rows.length === 0}>
        <ul className="card-soft divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex-1">
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-muted-foreground">{label(r.category)} · {r.occurred_on}</div>
              </div>
              <div className={`tabular-nums ${r.kind === "income" ? "font-medium text-success" : "font-medium"}`}>
                {r.kind === "income" ? "+" : "−"}{formatMoney(Number(r.amount), lang)}
              </div>
              <button type="button" aria-label={t("editLabel", { name: r.title })} onClick={() => setEditing(r)}
                className="text-muted-foreground hover:text-foreground">
                <Pencil className="size-4" />
              </button>
              <ConfirmDelete name={r.title} onConfirm={() => remove.mutate(r.id)}>
                <button type="button" aria-label={t("deleteLabel", { name: r.title })} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </ConfirmDelete>
            </li>
          ))}
        </ul>
      </ListState>

      {editing && (
        <EditTransaction key={editing.id} tx={editing} onClose={() => setEditing(null)}
          onSave={(values) => update.mutate({ id: editing.id, values }, { onSuccess: () => setEditing(null) })} />
      )}
    </>
  );
}

function KindToggle({ kind, onChange }: { kind: Kind; onChange: (k: Kind) => void }) {
  const { t } = useLang();
  return (
    <div className="flex rounded-full bg-muted p-1 sm:col-span-6 sm:w-fit" role="radiogroup">
      {(["expense", "income"] as const).map((k) => (
        <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => onChange(k)}
          className={`rounded-full px-4 py-1.5 text-sm ${kind === k ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
          {t(k)}
        </button>
      ))}
    </div>
  );
}

function CategorySelect({ value, onChange, id, ...rest }: {
  value: CategoryKey; onChange: (c: CategoryKey) => void; id?: string; "aria-label"?: string;
}) {
  const { t } = useLang();
  return (
    <select id={id} className={selectClass} value={value} onChange={(e) => onChange(e.target.value as CategoryKey)} {...rest}>
      {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{t(`cat_${k}` as Key)}</option>)}
    </select>
  );
}

function EditTransaction({ tx, onClose, onSave }: {
  tx: Row<"transactions">;
  onClose: () => void;
  onSave: (v: { title: string; amount: number; kind: Kind; category: CategoryKey; occurred_on: string }) => void;
}) {
  const { t } = useLang();
  const [title, setTitle] = useState(tx.title);
  const [amount, setAmount] = useState(String(tx.amount));
  const [kind, setKind] = useState<Kind>(tx.kind === "income" ? "income" : "expense");
  const [category, setCategory] = useState<CategoryKey>(categoryKey(tx.category) ?? "other");
  const [date, setDate] = useState(tx.occurred_on);
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("edit")}
      onSubmit={() => title.trim() && Number(amount) > 0 && onSave({ title: title.trim(), amount: Number(amount), kind, category, occurred_on: date })}>
      <KindToggle kind={kind} onChange={setKind} />
      <Field id="edit-tx-title" label={t("title")}>
        <Input id="edit-tx-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field id="edit-tx-amount" label={`${t("amount")} (EGP)`}>
        <Input id="edit-tx-amount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field id="edit-tx-category" label={t("category")}>
        <CategorySelect id="edit-tx-category" value={category} onChange={setCategory} />
      </Field>
      <Field id="edit-tx-date" label={t("date")}>
        <Input id="edit-tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
    </FormDialog>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "rounded-2xl bg-primary p-5 text-primary-foreground" : "card-soft p-5"}>
      <div className="text-sm opacity-75">{label}</div>
      <div className="mt-2 font-display text-3xl tabular-nums">{value}</div>
    </div>
  );
}
