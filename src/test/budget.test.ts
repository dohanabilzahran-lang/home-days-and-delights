import { describe, expect, it } from "vitest";
import { monthTotals, monthsLeft, shiftMonth, suggestPlan, type Tx } from "@/lib/budget";

const key = (s: string) => s;
const tx = (occurred_on: string, category: string, amount: number, kind = "expense"): Tx => ({ occurred_on, category, amount, kind });

describe("months", () => {
  it("shifts across years", () => expect(shiftMonth("2026-01", -1)).toBe("2025-12"));
  it("shifts forward", () => expect(shiftMonth("2026-10", 3)).toBe("2027-01"));
});

describe("month totals", () => {
  const txs = [tx("2026-10-01", "salary", 20000, "income"), tx("2026-10-05", "groceries", 3000), tx("2026-10-09", "bills", 1500), tx("2026-09-30", "groceries", 999)];
  it("adds income, spending and categories for one month only", () =>
    expect(monthTotals(txs, "2026-10", key)).toEqual({ income: 20000, spent: 4500, byCategory: { groceries: 3000, bills: 1500 } }));
});

describe("plan suggestions", () => {
  it("uses a default split with no history", () => {
    const { plan, basis } = suggestPlan(20000, [], "2026-10", key);
    expect(basis).toBe("default");
    expect(plan['groceries']).toBe(5000);
    expect(Object.values(plan).reduce((a, b) => a + b, 0)).toBe(17000); // 85%; 15% left for savings
  });
  it("averages the last months when there are at least two", () => {
    const txs = [tx("2026-09-03", "groceries", 4000), tx("2026-08-03", "groceries", 5000)];
    const { plan, basis, monthsUsed } = suggestPlan(20000, txs, "2026-10", key);
    expect(basis).toBe("history");
    expect(monthsUsed).toBe(2);
    expect(plan['groceries']).toBe(4500);
  });
  it("scales down so savings stay at 15% of income", () => {
    const txs = [tx("2026-09-03", "groceries", 20000), tx("2026-08-03", "groceries", 20000)];
    const { plan } = suggestPlan(10000, txs, "2026-10", key);
    expect(plan['groceries']).toBe(8500);
  });
});

describe("installments", () => {
  it("rounds months up", () => expect(monthsLeft(2500, 1000)).toBe(3));
  it("paid off is zero", () => expect(monthsLeft(0, 1000)).toBe(0));
  it("no monthly amount → unknown", () => expect(monthsLeft(500, null)).toBeNull());
});
