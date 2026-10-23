import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Home, Wallet, Sparkles, Brush, Baby, ChefHat, LogOut, MoreHorizontal, Briefcase, UtensilsCrossed, ShoppingBasket, CalendarDays, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LangToggle, useLang, type Key } from "@/lib/i18n";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NotificationBell } from "@/components/NotificationBell";
import { useReminderSweep } from "@/lib/useCalendar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppShell,
});

type To = "/dashboard" | "/budget" | "/skincare" | "/cleaning" | "/kids" | "/recipes" | "/work" | "/meals" | "/shopping" | "/calendar" | "/settings";
type NavItem = { to: To; key: Key; icon: typeof Home; primary?: boolean };

/**
 * One list drives both menus. New sections (calendar, meals, shopping, work) slot into a group;
 * only items marked `primary` get a phone tab, the rest live under "More".
 */
const groups: { label?: Key; items: NavItem[] }[] = [
  { items: [
    { to: "/dashboard", key: "today", icon: Home, primary: true },
    { to: "/calendar", key: "calendar", icon: CalendarDays, primary: true },
  ] },
  { label: "navHome", items: [
    { to: "/cleaning", key: "cleaning", icon: Brush, primary: true },
    { to: "/meals", key: "meals", icon: UtensilsCrossed },
    { to: "/shopping", key: "shopping", icon: ShoppingBasket },
    { to: "/recipes", key: "recipes", icon: ChefHat },
  ] },
  { label: "navFamily", items: [
    { to: "/kids", key: "kids", icon: Baby, primary: true },
    { to: "/skincare", key: "skincare", icon: Sparkles },
  ] },
  { label: "navMoney", items: [{ to: "/budget", key: "budget", icon: Wallet }] },
  { label: "navWork", items: [{ to: "/work", key: "work", icon: Briefcase }] },
  { items: [{ to: "/settings", key: "settings", icon: Settings }] },
];

const allItems = groups.flatMap((g) => g.items);
const primaryItems = allItems.filter((i) => i.primary);

function AppShell() {
  const { t } = useLang();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  useReminderSweep();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar p-5 text-sidebar-foreground md:flex">
        <div className="mb-8 flex items-center justify-between">
          <span className="font-display text-2xl text-sidebar-accent-foreground">{t("appName")}</span>
          <NotificationBell className="hover:bg-sidebar-accent" />
        </div>
        <nav className="flex flex-1 flex-col gap-5">
          {groups.map((g, gi) => (
            <div key={gi} className="flex flex-col gap-1">
              {g.label && <div className="px-3 pb-1 text-xs uppercase tracking-wider opacity-60">{t(g.label)}</div>}
              {g.items.map(({ to, key, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent"
                  activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
                >
                  <Icon className="size-4" /> {t(key)}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="flex flex-col gap-2">
          <LangToggle className="border-sidebar-border hover:bg-sidebar-accent" />
          <button onClick={signOut} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent">
            <LogOut className="size-4" /> {t("signOut")}
          </button>
        </div>
      </aside>

      <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
        <span className="font-display text-xl">{t("appName")}</span>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <LangToggle />
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-10 md:pt-10">
        <div className="mx-auto max-w-4xl">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-border bg-card py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
        {primaryItems.map(({ to, key, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex min-w-14 flex-col items-center gap-0.5 px-2 text-[11px] text-muted-foreground"
            activeProps={{ className: "text-primary font-medium" }}
          >
            <Icon className="size-5" /> {t(key)}
          </Link>
        ))}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger className="flex min-w-14 flex-col items-center gap-0.5 px-2 text-[11px] text-muted-foreground">
            <MoreHorizontal className="size-5" /> {t("more")}
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <SheetHeader>
              <SheetTitle className="font-display text-2xl">{t("more")}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {allItems.filter((i) => !i.primary).map(({ to, key, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-secondary p-4 text-sm"
                  activeProps={{ className: "ring-2 ring-primary" }}
                >
                  <Icon className="size-5" /> {t(key)}
                </Link>
              ))}
            </div>
            <button onClick={signOut} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm">
              <LogOut className="size-4" /> {t("signOut")}
            </button>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
