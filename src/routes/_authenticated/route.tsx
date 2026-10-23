import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Home, Wallet, Sparkles, Brush, Baby, ChefHat, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LangToggle, useLang, type Key } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppShell,
});

const nav: { to: "/dashboard" | "/budget" | "/skincare" | "/cleaning" | "/kids" | "/recipes"; key: Key; icon: typeof Home }[] = [
  { to: "/dashboard", key: "today", icon: Home },
  { to: "/budget", key: "budget", icon: Wallet },
  { to: "/skincare", key: "skincare", icon: Sparkles },
  { to: "/cleaning", key: "cleaning", icon: Brush },
  { to: "/kids", key: "kids", icon: Baby },
  { to: "/recipes", key: "recipes", icon: ChefHat },
];

function AppShell() {
  const { t } = useLang();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar p-5 text-sidebar-foreground md:flex">
        <div className="mb-8 font-display text-2xl text-sidebar-accent-foreground">{t("appName")}</div>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map(({ to, key, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
            >
              <Icon className="size-4" /> {t(key)}
            </Link>
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
        <div className="flex items-center gap-2">
          <LangToggle />
          <button onClick={signOut} aria-label={t("signOut")} className="rounded-full p-2 hover:bg-muted">
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-10 md:pt-10">
        <div className="mx-auto max-w-4xl">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-border bg-card py-2 md:hidden">
        {nav.map(({ to, key, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-0.5 px-2 text-[11px] text-muted-foreground"
            activeProps={{ className: "text-primary font-medium" }}
          >
            <Icon className="size-5" /> {t(key)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
