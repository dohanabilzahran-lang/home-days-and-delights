import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRows, todayISO } from "@/lib/data";
import { calendarItems } from "@/lib/calendar";
import { dueReminders } from "@/lib/reminders";

/** Calendar items for a date range from everything the user has marked to show. */
export function useCalendarItems(from: string, to: string, withMeals: boolean) {
  const events = useRows("events");
  const work = useRows("work_items");
  const cleaning = useRows("cleaning_tasks");
  const kids = useRows("kids_tasks");
  const skincare = useRows("skincare_steps");
  const history = useRows("completions");
  const meals = useRows("meal_plan_entries");
  const recipes = useRows("recipes");
  const isPending = [events, work, cleaning, kids, skincare, history].some((q) => q.isPending);
  const items = calendarItems(
    {
      events: events.data ?? [],
      work: work.data ?? [],
      cleaning: cleaning.data ?? [],
      kids: kids.data ?? [],
      skincare: skincare.data ?? [],
      history: history.data ?? [],
      meals: withMeals
        ? (meals.data ?? []).map((m) => ({
            id: m.id, on_date: m.on_date, slot: m.slot,
            label: (m.recipe_id ? recipes.data?.find((r) => r.id === m.recipe_id)?.title : m.title) ?? "—",
          }))
        : [],
    },
    from,
    to,
    todayISO(),
  );
  return { items, isPending, events: events.data ?? [] };
}

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * While the app is open, turns due reminders into in-app notifications every 5 minutes.
 * Notifications are keyed (user + dedupe key), so repeated runs never duplicate them.
 * The server does the same for push notifications when the app is closed.
 */
export function useReminderSweep() {
  const qc = useQueryClient();
  const skincare = useRows("skincare_steps").data;
  const kids = useRows("kids_tasks").data;
  const children = useRows("children").data;
  const work = useRows("work_items").data;
  const events = useRows("events").data;
  const history = useRows("completions").data;
  const ready = !!(skincare && kids && work && events && history);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    async function sweep() {
      const due = dueReminders(
        {
          skincare: skincare ?? [],
          kids: (kids ?? []).map((k) => ({ ...k, child_name: children?.find((c) => c.id === k.child_id)?.name ?? null })),
          work: work ?? [],
          events: events ?? [],
          history: history ?? [],
        },
        todayISO(),
        nowHHMM(),
      );
      if (!due.length || cancelled) return;
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const userId = auth.user.id;
      const { error } = await supabase
        .from("notifications")
        .upsert(due.map((r) => ({ ...r, user_id: userId })), { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
      if (!error) qc.invalidateQueries({ queryKey: ["notifications"] });
    }
    sweep();
    const id = window.setInterval(sweep, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [ready, skincare, kids, children, work, events, history, qc]);
}
