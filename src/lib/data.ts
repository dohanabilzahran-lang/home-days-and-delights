import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type TableName =
  | "transactions"
  | "skincare_steps"
  | "cleaning_tasks"
  | "kids_tasks"
  | "recipes"
  | "rooms"
  | "children";
export type Row<T extends TableName> = Tables[T]["Row"];
export type Insert<T extends TableName> = Tables[T]["Insert"];
export type Update<T extends TableName> = Tables[T]["Update"];

const orderBy: Record<TableName, { col: string; asc: boolean }> = {
  transactions: { col: "occurred_on", asc: false },
  skincare_steps: { col: "position", asc: true },
  cleaning_tasks: { col: "created_at", asc: true },
  kids_tasks: { col: "at_time", asc: true },
  recipes: { col: "created_at", asc: false },
  rooms: { col: "position", asc: true },
  children: { col: "position", asc: true },
};

export function useRows<T extends TableName>(table: T) {
  return useQuery({
    queryKey: [table],
    queryFn: async () => {
      const o = orderBy[table];
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

/**
 * Value to save in `last_done` when a check circle is tapped.
 * Ticking saves today and remembers the date it replaced; un-ticking restores that
 * date instead of clearing it, so an accidental double tap never erases history.
 */
export function nextLastDone(current: string | null, today: string, remembered: string | null | undefined) {
  if (current !== today) return today;
  return remembered ?? null;
}

// Dates replaced by a tick in this session, keyed by row id.
const replacedDates = new Map<string, string | null>();

type DoneTable = "cleaning_tasks" | "kids_tasks" | "skincare_steps";

export function useToggleDone<T extends DoneTable>(table: T) {
  const { update } = useTableMutations(table);
  return (row: { id: string; last_done: string | null }, today = todayISO()) => {
    const next = nextLastDone(row.last_done, today, replacedDates.get(row.id));
    if (next === today) replacedDates.set(row.id, row.last_done);
    else replacedDates.delete(row.id);
    update.mutate({ id: row.id, values: { last_done: next } as Update<T> });
  };
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
