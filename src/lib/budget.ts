import type { CategoryKey } from "@/lib/data";

/** Expense categories that get a monthly plan (salary is income, not spending). */
export const PLAN_CATEGORIES: CategoryKey[] = ["groceries", "bills", "kids", "home", "transport", "beauty", "other"];

/** Starting split of monthly income when there isn't enough history yet. Remainder (15%) is savings. */
const DEFAULT_SHARE: Record<string, number> = {
  groceries: 0.25, bills: 0.15, kids: 0.15, home: 0.1, transport: 0.1, beauty: 0.05, other: 0.05,
};
export const SAVINGS_SHARE = 0.15;

export type Tx = { amount: number | string; kind: string; category: string; occurred_on: string };

/** "2026-10" for a date; the budget month runs from the 1st (decision 8). */
export const monthOf = (date: string) => date.slice(0, 7);
export const firstDay = (month: string) => `${month}-01`;
export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function monthTotals(txs: Tx[], month: string, key: (stored: string) => string | null) {
  let income = 0;
  let spent = 0;
  const byCategory: Record<string, number> = {};
  for (const tx of txs) {
    if (monthOf(tx.occurred_on) !== month) continue;
    const amt = Number(tx.amount);
    if (tx.kind === "income") income += amt;
    else {
      spent += amt;
      const k = key(tx.category) ?? "other";
      byCategory[k] = (byCategory[k] ?? 0) + amt;
    }
  }
  return { income, spent, byCategory };
}

const round50 = (n: number) => Math.round(n / 50) * 50;

/**
 * Suggested plan per category for a month.
 * With 2+ earlier months of spending: the average of the last 3 months per category,
 * scaled down if needed so the plan leaves at least 15% of income for savings.
 * Otherwise: a default split of income. Amounts are rounded to 50 EGP; the user edits before saving.
 */
export function suggestPlan(income: number, txs: Tx[], month: string, key: (stored: string) => string | null) {
  const prior = [1, 2, 3].map((n) => shiftMonth(month, -n));
  const months = prior.map((m) => monthTotals(txs, m, key)).filter((m) => m.spent > 0);
  const budgetable = income * (1 - SAVINGS_SHARE);
  let plan: Record<string, number>;
  let basis: "history" | "default";
  if (months.length >= 2) {
    basis = "history";
    plan = {};
    for (const c of PLAN_CATEGORIES) plan[c] = months.reduce((s, m) => s + (m.byCategory[c] ?? 0), 0) / months.length;
    const total = Object.values(plan).reduce((s, v) => s + v, 0);
    if (income > 0 && total > budgetable) for (const c of PLAN_CATEGORIES) plan[c] = (plan[c] ?? 0) * (budgetable / total);
  } else {
    basis = "default";
    plan = Object.fromEntries(PLAN_CATEGORIES.map((c) => [c, income * (DEFAULT_SHARE[c] ?? 0)]));
  }
  for (const c of PLAN_CATEGORIES) plan[c] = round50(plan[c] ?? 0);
  return { plan, basis, monthsUsed: months.length };
}

/** Months left on an installment, given what remains and the monthly payment. */
export function monthsLeft(remaining: number, monthly: number | null) {
  if (!monthly || monthly <= 0 || remaining <= 0) return remaining <= 0 ? 0 : null;
  return Math.ceil(remaining / monthly);
}
