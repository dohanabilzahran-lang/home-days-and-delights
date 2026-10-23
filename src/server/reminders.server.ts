import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dueReminders } from "@/lib/reminders";
import { addDays } from "@/lib/recurrence";
import { getVapidKeys } from "@/server/config.server";
import { sendPush } from "@/server/webpush.server";

/** Local date ("YYYY-MM-DD") and time ("HH:MM") in a time zone, e.g. Africa/Cairo (handles DST). */
export function localNow(timeZone: string, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts["year"]}-${parts["month"]}-${parts["day"]}`, time: `${parts["hour"]}:${parts["minute"]}` };
}

async function rows<T>(q: PromiseLike<{ data: T[] | null; error: unknown }>) {
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** Sends one push to every device of a user; removes devices the push service says are gone. */
export async function pushToUser(userId: string, message: { title: string; body?: string; url?: string; tag?: string }) {
  const subs = await rows(supabaseAdmin.from("push_subscriptions").select("*").eq("user_id", userId));
  const keys = await getVapidKeys();
  let sent = 0;
  for (const s of subs) {
    try {
      const r = await sendPush(s, message, keys);
      if (r.gone) await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
      else if (r.ok) {
        sent++;
        await supabaseAdmin.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", s.id);
      }
    } catch {
      // One failing device must not stop the others.
    }
  }
  return sent;
}

/**
 * Run by the scheduled job (every 5 minutes). For each user with a push device: create due
 * reminders as notifications (de-duplicated), then push every notification not yet pushed.
 * Safe to run twice: duplicates are refused by the database and pushed_at is set once.
 */
export async function runReminders() {
  const subs = await rows(supabaseAdmin.from("push_subscriptions").select("user_id"));
  const users = [...new Set(subs.map((s) => s.user_id))];
  let pushed = 0;
  for (const userId of users) {
    const profile = (await rows(supabaseAdmin.from("profiles").select("timezone").eq("user_id", userId)))[0];
    const { date, time } = localNow(profile?.timezone ?? "Africa/Cairo");
    const [skincare, kids, children, work, events, history] = await Promise.all([
      rows(supabaseAdmin.from("skincare_steps").select("*").eq("user_id", userId)),
      rows(supabaseAdmin.from("kids_tasks").select("*").eq("user_id", userId)),
      rows(supabaseAdmin.from("children").select("id,name").eq("user_id", userId)),
      rows(supabaseAdmin.from("work_items").select("*").eq("user_id", userId)),
      rows(supabaseAdmin.from("events").select("*").eq("user_id", userId).eq("starts_on", date)),
      rows(supabaseAdmin.from("completions").select("*").eq("user_id", userId).gte("on_date", addDays(date, -1))),
    ]);
    const due = dueReminders(
      { skincare, kids: kids.map((k) => ({ ...k, child_name: children.find((c) => c.id === k.child_id)?.name ?? null })), work, events, history },
      date,
      time,
    );
    if (due.length) {
      await supabaseAdmin.from("notifications")
        .upsert(due.map((r) => ({ ...r, user_id: userId })), { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
    }
    const pending = await rows(
      supabaseAdmin.from("notifications").select("*").eq("user_id", userId).is("pushed_at", null).is("read_at", null)
        .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
    );
    for (const n of pending) {
      // Claim first, so a parallel run can't push the same notification again.
      const claim = await supabaseAdmin.from("notifications").update({ pushed_at: new Date().toISOString() })
        .eq("id", n.id).is("pushed_at", null).select("id");
      if (!claim.data?.length) continue;
      pushed += await pushToUser(userId, { title: n.title, body: n.body, url: n.url ?? "/dashboard", tag: n.dedupe_key });
    }
  }
  return { users: users.length, pushed };
}
