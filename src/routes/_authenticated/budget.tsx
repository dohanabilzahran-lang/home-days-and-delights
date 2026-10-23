import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLang, type Key } from "@/lib/i18n";
import {
  CATEGORY_KEYS, categoryKey, formatMoney, todayISO, useProfile, useRows, useTableMutations, type CategoryKey, type Row,
} from "@/lib/data";
import { firstDay, monthOf, monthTotals, monthsLeft, PLAN_CATEGORIES, SAVINGS_SHARE, shiftMonth, suggestPlan } from "@/lib/budget";
import { PageHeader, ListState } from "@/components/PageHeader";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { FormDialog, Field } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/budget")({
  head: () => ({ meta: [{ title: "Budget — Nest" }, { name: "description", content: "Monthly budget in EGP: plan, spending, goals and debts." }] }),
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

function useMonthName() {
  const { lang } = useLang();
  return (month: string) =>
    new Date(`${month}-01T12:00:00Z`).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

function Budget() {
  const { t } = useLang();
  const monthName = useMonthName();
  const [month, setMonth] = useState(monthOf(todayISO()));

  return (
    <>
      <PageHeader title={t("budget")}>
        <div className="flex items-center gap-1 rounded-full border border-border p-1">
          <Button variant="ghost" size="icon" className="rounded-full" aria-label={t("prevMonth")} onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft className="size-4 rtl:rotate-180" />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium">{monthName(month)}</span>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label={t("nextMonth")} onClick={() => setMonth(shiftMonth(month, 1))}>
            <ChevronRight className="size-4 rtl:rotate-180" />
          </Button>
        </div>
      </PageHeader>
      <Tabs defaultValue="overview">
        <TabsList className="mb-6 flex h-auto flex-wrap justify-start rounded-full">
          <TabsTrigger value="overview" className="rounded-full">{t("overview")}</TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-full">{t("transactions")}</TabsTrigger>
          <TabsTrigger value="goals" className="rounded-full">{t("goals")}</TabsTrigger>
          <TabsTrigger value="debts" className="rounded-full">{t("debts")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><Overview month={month} /></TabsContent>
        <TabsContent value="transactions"><Transactions month={month} /></TabsContent>
        <TabsContent value="goals"><Goals /></TabsContent>
        <TabsContent value="debts"><Debts /></TabsContent>
      </Tabs>
    </>
  );
}

// ───────────── Overview ─────────────

function Overview({ month }: { month: string }) {
  const { t, lang } = useLang();
  const label = useCategoryLabel();
  const monthName = useMonthName();
  const { income, save: saveProfile } = useProfile();
  const txs = useRows("transactions").data ?? [];
  const plans = useRows("budget_plans").data ?? [];
  const qc = useQueryClient();
  const [incomeDraft, setIncomeDraft] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ReturnType<typeof suggestPlan> | null>(null);

  const totals = monthTotals(txs, month, categoryKey);
  const planFor = (c: string) => Number(plans.find((p) => p.month === firstDay(month) && p.category === c)?.planned ?? 0);
  const left = income + totals.income - totals.spent;

  async function savePlan(plan: Record<string, number>) {
    const rows = Object.entries(plan).map(([category, planned]) => ({ month: firstDay(month), category, planned }));
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const userId = auth.user.id;
    const { error } = await supabase
      .from("budget_plans")
      .upsert(rows.map((r) => ({ ...r, user_id: userId })), { onConflict: "user_id,month,category" });
    if (error) toast.error(t("saveFailed"), { description: error.message });
    else qc.invalidateQueries({ queryKey: ["budget_plans"] });
  }

  const history = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5)).map((m) => ({ m, ...monthTotals(txs, m, categoryKey) }));
  const maxBar = Math.max(1, ...history.map((h) => Math.max(h.spent, income + h.income)));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
          <div className="text-sm opacity-75">{t("leftToSpend")}</div>
          <div className="mt-2 font-display text-3xl tabular-nums">{formatMoney(left, lang)}</div>
        </div>
        <div className="card-soft p-5">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            {t("monthlyIncome")}
            <button type="button" aria-label={t("edit")} onClick={() => setIncomeDraft(String(income || ""))}><Pencil className="size-3.5" /></button>
          </div>
          <div className="mt-2 font-display text-3xl tabular-nums">{formatMoney(income, lang)}</div>
          {totals.income > 0 && <div className="mt-1 text-xs text-muted-foreground">+ {formatMoney(totals.income, lang)} · {t("extraIncome")}</div>}
        </div>
        <div className="card-soft p-5">
          <div className="text-sm text-muted-foreground">{t("spent")}</div>
          <div className="mt-2 font-display text-3xl tabular-nums">{formatMoney(totals.spent, lang)}</div>
        </div>
      </div>

      {income === 0 && (
        <button type="button" onClick={() => setIncomeDraft("")}
          className="w-full rounded-xl border border-dashed border-border p-5 text-center text-muted-foreground hover:border-primary">
          {t("setIncome")}
        </button>
      )}

      <section className="card-soft p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl">{t("planVsActual")}</h2>
          <Button variant="outline" className="rounded-full" disabled={income === 0}
            onClick={() => setSuggestion(suggestPlan(income, txs, month, categoryKey))}>
            <Wand2 className="size-4" /> {t("suggestPlan")}
          </Button>
        </div>
        <ul className="space-y-4">
          {PLAN_CATEGORIES.map((c) => {
            const planned = planFor(c);
            const spent = totals.byCategory[c] ?? 0;
            const over = planned > 0 && spent > planned;
            return (
              <li key={c} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{label(c)}</span>
                  <span className={`tabular-nums ${over ? "text-destructive" : "text-muted-foreground"}`}>
                    {over ? t("overBy", { a: formatMoney(spent - planned, lang) })
                      : t("spentOf", { a: formatMoney(spent, lang), b: planned ? formatMoney(planned, lang) : "—" })}
                  </span>
                </div>
                <Progress value={planned ? Math.min(100, (spent / planned) * 100) : 0}
                  className={`h-2 ${over ? "[&>div]:bg-destructive" : ""}`} aria-label={label(c)} />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card-soft p-5">
        <h2 className="mb-4 text-2xl">{t("lastMonths")}</h2>
        <div className="flex h-40 items-end gap-3" role="img" aria-label={t("lastMonths")}>
          {history.map((h) => (
            <div key={h.m} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-32 w-full items-end justify-center gap-1">
                <div className="w-1/3 rounded-t bg-sand" style={{ height: `${((income + h.income) / maxBar) * 100}%` }}
                  title={`${t("income")}: ${formatMoney(income + h.income, lang)}`} />
                <div className={`w-1/3 rounded-t ${h.m === month ? "bg-primary" : "bg-primary/50"}`} style={{ height: `${(h.spent / maxBar) * 100}%` }}
                  title={`${t("spent")}: ${formatMoney(h.spent, lang)}`} />
              </div>
              <span className="text-[11px] text-muted-foreground">{monthName(h.m).split(" ")[0]?.slice(0, 3)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-sand" />{t("income")}</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" />{t("spent")}</span>
        </div>
      </section>

      <FormDialog open={incomeDraft !== null} onOpenChange={(o) => !o && setIncomeDraft(null)} title={t("monthlyIncome")}
        onSubmit={() => {
          const v = Number(incomeDraft);
          if (v >= 0) saveProfile.mutate({ monthly_income: v }, { onSuccess: () => setIncomeDraft(null) });
        }}>
        <Field id="income" label={`${t("monthlyIncome")} (EGP)`}>
          <Input id="income" type="number" min={0} step="50" value={incomeDraft ?? ""} onChange={(e) => setIncomeDraft(e.target.value)} />
        </Field>
      </FormDialog>

      {suggestion && (
        <SuggestionDialog suggestion={suggestion} income={income} onClose={() => setSuggestion(null)}
          onApply={(plan) => savePlan(plan).then(() => setSuggestion(null))} />
      )}
    </div>
  );
}

function SuggestionDialog({ suggestion, income, onClose, onApply }: {
  suggestion: ReturnType<typeof suggestPlan>;
  income: number;
  onClose: () => void;
  onApply: (plan: Record<string, number>) => void;
}) {
  const { t, lang } = useLang();
  const label = useCategoryLabel();
  const [plan, setPlan] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(suggestion.plan).map(([k, v]) => [k, String(v)])),
  );
  const total = Object.values(plan).reduce((s, v) => s + (Number(v) || 0), 0);
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("suggestPlan")} submitLabel={t("applyPlan")}
      onSubmit={() => onApply(Object.fromEntries(Object.entries(plan).map(([k, v]) => [k, Math.max(0, Number(v) || 0)])))}>
      <p className="text-sm text-muted-foreground">
        {suggestion.basis === "history" ? t("suggestHistory", { n: suggestion.monthsUsed }) : t("suggestDefault")}
      </p>
      {PLAN_CATEGORIES.map((c) => (
        <Field key={c} id={`plan-${c}`} label={`${label(c)} (EGP)`}>
          <Input id={`plan-${c}`} type="number" min={0} step="50" value={plan[c] ?? ""} onChange={(e) => setPlan({ ...plan, [c]: e.target.value })} />
        </Field>
      ))}
      <p className={`text-sm tabular-nums ${income - total < income * SAVINGS_SHARE ? "text-destructive" : "text-muted-foreground"}`}>
        {t("savingsLeft", { a: formatMoney(income - total, lang) })}
      </p>
    </FormDialog>
  );
}

// ───────────── Transactions ─────────────

function Transactions({ month }: { month: string }) {
  const { t, lang } = useLang();
  const label = useCategoryLabel();
  const query = useRows("transactions");
  const rows = (query.data ?? []).filter((r) => monthOf(r.occurred_on) === month);
  const { add, update, remove } = useTableMutations("transactions");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<Kind>("expense");
  const [category, setCategory] = useState<CategoryKey>("groceries");
  const [date, setDate] = useState(todayISO());
  const [editing, setEditing] = useState<Row<"transactions"> | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !(Number(amount) > 0)) return;
    add.mutate({ title: title.trim(), amount: Number(amount), kind, category, occurred_on: date });
    setTitle("");
    setAmount("");
  }

  return (
    <>
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
              <div className="min-w-0 flex-1">
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

// ───────────── Savings goals ─────────────

function Goals() {
  const { t, lang } = useLang();
  const query = useRows("savings_goals");
  const goals = query.data ?? [];
  const { add, update, remove } = useTableMutations("savings_goals");
  const [form, setForm] = useState<null | { id?: string; name: string; target: string; date: string }>(null);
  const [adding, setAdding] = useState<Row<"savings_goals"> | null>(null);
  const [amount, setAmount] = useState("");

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button className="rounded-full" onClick={() => setForm({ name: "", target: "", date: "" })}><Plus className="size-4" /> {t("newGoal")}</Button>
      </div>
      <ListState query={query} isEmpty={goals.length === 0}>
        <ul className="grid gap-4 sm:grid-cols-2">
          {goals.map((g) => {
            const pct = Math.min(100, (Number(g.saved) / Number(g.target)) * 100);
            return (
              <li key={g.id} className="card-soft space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xl">{g.name}</h3>
                    {g.target_date && <div className="text-xs text-muted-foreground">{t("targetDate")}: {g.target_date}</div>}
                  </div>
                  <div className="flex gap-2.5">
                    <button type="button" aria-label={t("editLabel", { name: g.name })} className="text-muted-foreground"
                      onClick={() => setForm({ id: g.id, name: g.name, target: String(g.target), date: g.target_date ?? "" })}><Pencil className="size-4" /></button>
                    <ConfirmDelete name={g.name} onConfirm={() => remove.mutate(g.id)}>
                      <button type="button" aria-label={t("deleteLabel", { name: g.name })} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
                    </ConfirmDelete>
                  </div>
                </div>
                <div className="text-sm tabular-nums">{t("spentOf", { a: formatMoney(Number(g.saved), lang), b: formatMoney(Number(g.target), lang) })}</div>
                <Progress value={pct} className="h-2" aria-label={g.name} />
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => { setAmount(""); setAdding(g); }}>
                  <Plus className="size-3.5" /> {t("addMoney")}
                </Button>
              </li>
            );
          })}
        </ul>
      </ListState>

      <FormDialog open={!!form} onOpenChange={(o) => !o && setForm(null)} title={form?.id ? t("edit") : t("newGoal")}
        onSubmit={() => {
          if (!form || !form.name.trim() || !(Number(form.target) > 0)) return;
          const values = { name: form.name.trim(), target: Number(form.target), target_date: form.date || null };
          if (form.id) update.mutate({ id: form.id, values }, { onSuccess: () => setForm(null) });
          else add.mutate(values, { onSuccess: () => setForm(null) });
        }}>
        <Field id="goal-name" label={t("name")}>
          <Input id="goal-name" value={form?.name ?? ""} onChange={(e) => form && setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field id="goal-target" label={`${t("target")} (EGP)`}>
          <Input id="goal-target" type="number" min={1} value={form?.target ?? ""} onChange={(e) => form && setForm({ ...form, target: e.target.value })} />
        </Field>
        <Field id="goal-date" label={t("targetDate")}>
          <Input id="goal-date" type="date" value={form?.date ?? ""} onChange={(e) => form && setForm({ ...form, date: e.target.value })} />
        </Field>
      </FormDialog>

      <FormDialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)} title={t("addMoney")}
        onSubmit={() => {
          const v = Number(amount);
          if (adding && v > 0) update.mutate({ id: adding.id, values: { saved: Number(adding.saved) + v } }, { onSuccess: () => setAdding(null) });
        }}>
        <Field id="goal-add" label={`${t("amount")} (EGP)`}>
          <Input id="goal-add" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      </FormDialog>
    </>
  );
}

// ───────────── Debts and installments ─────────────

function Debts() {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const query = useRows("debts");
  const debts = query.data ?? [];
  const payments = useRows("debt_payments").data ?? [];
  const { add, update, remove } = useTableMutations("debts");
  const [form, setForm] = useState<null | { id?: string; name: string; total: string; monthly: string; dueDay: string }>(null);
  const [paying, setPaying] = useState<Row<"debts"> | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  /** A payment is also recorded as a budget expense, linked so it is counted once. */
  async function recordPayment() {
    const v = Number(amount);
    if (!paying || !(v > 0) || busy) return;
    setBusy(true);
    const tx = await supabase.from("transactions")
      .insert({ title: t("paymentFor", { name: paying.name }), amount: v, kind: "expense", category: "bills", occurred_on: date, source: "debt" })
      .select("id").single();
    if (tx.error) {
      setBusy(false);
      toast.error(t("saveFailed"), { description: tx.error.message });
      return;
    }
    const p = await supabase.from("debt_payments").insert({ debt_id: paying.id, amount: v, paid_on: date, transaction_id: tx.data.id });
    setBusy(false);
    if (p.error) {
      await supabase.from("transactions").delete().eq("id", tx.data.id);
      toast.error(t("saveFailed"), { description: p.error.message });
      return;
    }
    qc.invalidateQueries({ queryKey: ["debt_payments"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    setPaying(null);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button className="rounded-full" onClick={() => setForm({ name: "", total: "", monthly: "", dueDay: "" })}><Plus className="size-4" /> {t("newDebt")}</Button>
      </div>
      <ListState query={query} isEmpty={debts.length === 0}>
        <ul className="grid gap-4 sm:grid-cols-2">
          {debts.map((d) => {
            const paid = payments.filter((p) => p.debt_id === d.id).reduce((s, p) => s + Number(p.amount), 0);
            const remaining = Math.max(0, Number(d.total) - paid);
            const left = monthsLeft(remaining, d.monthly_payment === null ? null : Number(d.monthly_payment));
            return (
              <li key={d.id} className="card-soft space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xl">{d.name}</h3>
                    <div className="text-xs text-muted-foreground">
                      {[d.monthly_payment && `${t("monthlyPayment")}: ${formatMoney(Number(d.monthly_payment), lang)}`, d.due_day && `${t("dueDay")}: ${d.due_day}`].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="flex gap-2.5">
                    <button type="button" aria-label={t("editLabel", { name: d.name })} className="text-muted-foreground"
                      onClick={() => setForm({ id: d.id, name: d.name, total: String(d.total), monthly: d.monthly_payment ? String(d.monthly_payment) : "", dueDay: d.due_day ? String(d.due_day) : "" })}>
                      <Pencil className="size-4" />
                    </button>
                    <ConfirmDelete name={d.name} onConfirm={() => remove.mutate(d.id)}>
                      <button type="button" aria-label={t("deleteLabel", { name: d.name })} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
                    </ConfirmDelete>
                  </div>
                </div>
                <div className="flex justify-between text-sm tabular-nums">
                  <span>{remaining === 0 ? t("paidOff") : t("remaining", { a: formatMoney(remaining, lang) })}</span>
                  {left ? <span className="text-muted-foreground">{t("monthsLeft", { n: left })}</span> : null}
                </div>
                <Progress value={Math.min(100, (paid / Number(d.total)) * 100)} className="h-2" aria-label={d.name} />
                {remaining > 0 && (
                  <Button variant="outline" size="sm" className="rounded-full"
                    onClick={() => { setAmount(d.monthly_payment ? String(Math.min(Number(d.monthly_payment), remaining)) : ""); setDate(todayISO()); setPaying(d); }}>
                    {t("recordPayment")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </ListState>

      <FormDialog open={!!form} onOpenChange={(o) => !o && setForm(null)} title={form?.id ? t("edit") : t("newDebt")}
        onSubmit={() => {
          if (!form || !form.name.trim() || !(Number(form.total) > 0)) return;
          const day = Number(form.dueDay);
          const values = {
            name: form.name.trim(),
            total: Number(form.total),
            monthly_payment: Number(form.monthly) > 0 ? Number(form.monthly) : null,
            due_day: day >= 1 && day <= 31 ? Math.round(day) : null,
          };
          if (form.id) update.mutate({ id: form.id, values }, { onSuccess: () => setForm(null) });
          else add.mutate(values, { onSuccess: () => setForm(null) });
        }}>
        <Field id="debt-name" label={t("name")}>
          <Input id="debt-name" value={form?.name ?? ""} onChange={(e) => form && setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field id="debt-total" label={`${t("totalOwed")} (EGP)`}>
          <Input id="debt-total" type="number" min={1} value={form?.total ?? ""} onChange={(e) => form && setForm({ ...form, total: e.target.value })} />
        </Field>
        <Field id="debt-monthly" label={`${t("monthlyPayment")} (EGP)`}>
          <Input id="debt-monthly" type="number" min={0} value={form?.monthly ?? ""} onChange={(e) => form && setForm({ ...form, monthly: e.target.value })} />
        </Field>
        <Field id="debt-due" label={t("dueDay")}>
          <Input id="debt-due" type="number" min={1} max={31} value={form?.dueDay ?? ""} onChange={(e) => form && setForm({ ...form, dueDay: e.target.value })} />
        </Field>
      </FormDialog>

      <FormDialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)} title={t("recordPayment")} onSubmit={recordPayment}>
        <Field id="pay-amount" label={`${t("amount")} (EGP)`}>
          <Input id="pay-amount" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field id="pay-date" label={t("date")}>
          <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </FormDialog>
    </>
  );
}
