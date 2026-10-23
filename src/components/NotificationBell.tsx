import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bell } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { useRows } from "@/lib/data";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Bell with unread count; opens the in-app notification list. */
export function NotificationBell({ className = "" }: { className?: string }) {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const items = (useRows("notifications").data ?? []).slice(0, 50);
  const unread = items.filter((n) => !n.read_at);
  const [open, setOpen] = useState(false);

  async function markRead(ids: string[]) {
    if (!ids.length) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger aria-label={`${t("notifications")}${unread.length ? ` (${unread.length})` : ""}`}
        className={`relative rounded-full p-2 hover:bg-muted ${className}`}>
        <Bell className="size-5" />
        {unread.length > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </SheetTrigger>
      <SheetContent side={lang === "ar" ? "left" : "right"} className="w-full max-w-sm overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">{t("notifications")}</SheetTitle>
        </SheetHeader>
        {unread.length > 0 && (
          <button type="button" onClick={() => markRead(unread.map((n) => n.id))} className="mt-2 text-sm text-primary underline-offset-4 hover:underline">
            {t("markAllRead")}
          </button>
        )}
        {items.length === 0 ? (
          <p className="mt-8 text-center text-muted-foreground">{t("noNotifications")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {items.map((n) => (
              <li key={n.id}>
                <Link to={(n.url ?? "/dashboard") as "/dashboard"} onClick={() => { markRead([n.id]); setOpen(false); }}
                  className={`block py-3 ${n.read_at ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-2 font-medium">
                    {!n.read_at && <span className="size-2 rounded-full bg-destructive" aria-hidden />}
                    {n.title}
                  </div>
                  {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
                  <div className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
