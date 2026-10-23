import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
/** Every table the browser may use. Server-only tables (Google tokens, app config) are excluded. */
export type TableName = Exclude<keyof Tables, "google_connections" | "app_config">;
export type Row<T extends TableName> = Tables[T]["Row"];
export type Insert<T extends TableName> = Tables[T]["Insert"];
export type Update<T extends TableName> = Tables[T]["Update"];

const orderBy: Partial<Record<TableName, { col: string; asc: boolean }>> = {
  transactions: { col: "occurred_on", asc: false },
  skincare_steps: { col: "position", asc: true },
  kids_tasks: { col: "at_time", asc: true },
  recipes: { col: "created_at", asc: false },
  rooms: { col: "position", asc: true },
  children: { col: "position", asc: true },
  completions: { col: "on_date", asc: false },
  shopping_categories: { col: "position", asc: true },
  recipe_ingredients: { col: "position", asc: true },
  meal_plan_entries: { col: "position", asc: true },
  events: { col: "starts_on", asc: true },
  notifications: { col: "created_at", asc: false },
  debt_payments: { col: "paid_on", asc: false },
  budget_plans: { col: "month", asc: true },
};

export function useRows<T extends TableName>(table: T) {
  return useQuery({
    queryKey: [table],
    queryFn: async () => {
      const o = orderBy[table] ?? { col: "created_at", asc: true };
      const { data, error } = await supabase.from(table).select("*").order(o.col, { ascending: o.asc });
      if (error) throw error;
      return data as unknown as Row<T>[];
    },
  });
}

export function useTableMutations<T extends TableName>(table: T) {
  const qc = useQueryClient();
  const { t } = useLang();
  const done = () => qc.invalidateQueries({ queryKey: [table] });
  // Every failed write tells the user; nothing fails silently.
  const failed = (error: unknown) => {
    const detail = error && typeof error === "object" && "message" in error ? String(error.message) : "";
    toast.error(t("saveFailed"), { description: detail || undefined });
  };
  const add = useMutation({
    mutationFn: async (values: Insert<T>) => {
      const { error } = await supabase.from(table).insert(values as never);
      if (error) throw error;
    },
    onSuccess: done,
    onError: failed,
  });
  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Update<T> }) => {
      const { error } = await supabase.from(table).update(values as never).eq("id" as never, id as never);
      if (error) throw error;
    },
    onSuccess: done,
    onError: failed,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id" as never, id as never);
      if (error) throw error;
    },
    onSuccess: done,
    onError: failed,
  });
  return { add, update, remove };
}

export type RoutineSource = "cleaning" | "kids" | "skincare";
const routineTable = { cleaning: "cleaning_tasks", kids: "kids_tasks", skincare: "skincare_steps" } as const;

/**
 * Tick, un-tick, skip and postpone for repeating items. Each action is a row in `completions`
 * (one per item per day, so repeats never duplicate), and `last_done` on the item is kept in step.
 * Un-ticking deletes only that day's row, so earlier history is never lost.
 */
export function useRoutineActions(source: RoutineSource) {
  const qc = useQueryClient();
  const { t } = useLang();
  const table = routineTable[source];
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["completions"] });
    qc.invalidateQueries({ queryKey: [table] });
  };
  const failed = (error: unknown) => {
    const detail = error && typeof error === "object" && "message" in error ? String(error.message) : "";
    toast.error(t("saveFailed"), { description: detail || undefined });
  };
  const run = useMutation({
    mutationFn: async (fn: () => Promise<void>) => fn(),
    onSuccess: refresh,
    onError: failed,
  });
  const mark = async (id: string, onDate: string, status: "done" | "skipped") => {
    const { error } = await supabase
      .from("completions")
      .upsert({ source_type: source, source_id: id, on_date: onDate, status }, { onConflict: "source_type,source_id,on_date" });
    if (error) throw error;
  };
  const setItem = async (id: string, values: { last_done?: string | null; snoozed_until?: string | null }) => {
    const { error } = await supabase.from(table).update(values as never).eq("id", id);
    if (error) throw error;
  };
  return {
    complete: (id: string, onDate = todayISO()) =>
      run.mutate(async () => {
        await mark(id, onDate, "done");
        await setItem(id, { last_done: onDate, snoozed_until: null });
      }),
    uncomplete: (id: string, onDate = todayISO()) =>
      run.mutate(async () => {
        const del = await supabase.from("completions").delete().match({ source_type: source, source_id: id, on_date: onDate });
        if (del.error) throw del.error;
        const prev = await supabase
          .from("completions")
          .select("on_date")
          .match({ source_type: source, source_id: id, status: "done" })
          .order("on_date", { ascending: false })
          .limit(1);
        if (prev.error) throw prev.error;
        await setItem(id, { last_done: prev.data[0]?.on_date ?? null });
      }),
    skip: (id: string, onDate = todayISO()) =>
      run.mutate(async () => {
        await mark(id, onDate, "skipped");
        await setItem(id, { snoozed_until: null });
      }),
    postpone: (id: string, until: string) => run.mutate(() => setItem(id, { snoozed_until: until })),
  };
}

/** Completion history for one kind of routine (newest first). */
export function useHistory(source: RoutineSource) {
  const q = useRows("completions");
  return { ...q, data: (q.data ?? []).filter((c) => c.source_type === source) };
}

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Days until a recurring task is due again (negative = overdue, 0 = due today). */
export function daysUntilDue(lastDone: string | null, everyDays: number, today = todayISO()) {
  if (!lastDone) return 0;
  const diff = (Date.parse(today) - Date.parse(lastDone)) / 86400000;
  return Math.round(everyDays - diff);
}

/** Amounts are Egyptian pounds: "EGP 1,250" in English, "١٬٢٥٠ ج.م.‏" in Arabic. */
export function formatMoney(n: number, lang: "en" | "ar") {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n);
}

/** Stable budget category keys. Stored in `transactions.category`; translated on display. */
export const CATEGORY_KEYS = ["groceries", "bills", "kids", "beauty", "home", "transport", "salary", "other"] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

/** Older rows may hold a translated label instead of a key; map both languages back to the key. */
const LEGACY_LABELS: Record<string, CategoryKey> = {
  Groceries: "groceries", Bills: "bills", Kids: "kids", Beauty: "beauty", Home: "home", Transport: "transport", Salary: "salary", Other: "other",
  "بقالة": "groceries", "فواتير": "bills", "أطفال": "kids", "تجميل": "beauty", "منزل": "home", "مواصلات": "transport", "راتب": "salary", "أخرى": "other",
};

export function categoryKey(stored: string): CategoryKey | null {
  if ((CATEGORY_KEYS as readonly string[]).includes(stored)) return stored as CategoryKey;
  return LEGACY_LABELS[stored] ?? null;
}
