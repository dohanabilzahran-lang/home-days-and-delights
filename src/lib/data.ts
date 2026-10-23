import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type TableName = "transactions" | "skincare_steps" | "cleaning_tasks" | "kids_tasks" | "recipes";
export type Row<T extends TableName> = Tables[T]["Row"];
export type Insert<T extends TableName> = Tables[T]["Insert"];
export type Update<T extends TableName> = Tables[T]["Update"];

const orderBy: Record<TableName, { col: string; asc: boolean }> = {
  transactions: { col: "occurred_on", asc: false },
  skincare_steps: { col: "position", asc: true },
  cleaning_tasks: { col: "created_at", asc: true },
  kids_tasks: { col: "at_time", asc: true },
  recipes: { col: "created_at", asc: false },
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
  const done = () => qc.invalidateQueries({ queryKey: [table] });
  const add = useMutation({
    mutationFn: async (values: Insert<T>) => {
      const { error } = await supabase.from(table).insert(values as never);
      if (error) throw error;
    },
    onSuccess: done,
  });
  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Update<T> }) => {
      const { error } = await supabase.from(table).update(values as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: done,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: done,
  });
  return { add, update, remove };
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
