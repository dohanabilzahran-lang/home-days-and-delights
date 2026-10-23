import { createFileRoute, Link } from "@tanstack/react-router";
import { Wallet, Sparkles, Brush, Baby, ChefHat } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { daysUntilDue, todayISO, useRows } from "@/lib/data";
import { formatMoney } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Today — Nest" }, { name: "description", content: "Your day at a glance." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { t, lang } = useLang();
  const today = todayISO();
  const tx = useRows("transactions").data ?? [];
  const skin = useRows("skincare_steps").data ?? [];
  const clean = useRows("cleaning_tasks").data ?? [];
  const kids = useRows("kids_tasks").data ?? [];
  const recipes = useRows("recipes").data ?? [];

  const month = today.slice(0, 7);
  const balance = tx
    .filter((r) => r.occurred_on.startsWith(month))
    .reduce((s, r) => s + (r.kind === "income" ? 1 : -1) * Number(r.amount), 0);

  const cards = [
    { to: "/budget" as const, icon: Wallet, title: t("budget"), value: formatMoney(balance, lang), sub: t("balance") },
    { to: "/skincare" as const, icon: Sparkles, title: t("skincare"), value: t("doneOf", { a: skin.filter((s) => s.last_done === today).length, b: skin.length }), sub: t("today") },
    { to: "/cleaning" as const, icon: Brush, title: t("cleaning"), value: t("tasksDue", { n: clean.filter((c) => daysUntilDue(c.last_done, c.every_days, today) <= 0).length }), sub: t("today") },
    { to: "/kids" as const, icon: Baby, title: t("kids"), value: t("doneOf", { a: kids.filter((k) => k.last_done === today).length, b: kids.length }), sub: t("today") },
    { to: "/recipes" as const, icon: ChefHat, title: t("recipes"), value: t("saved", { n: recipes.length }), sub: "" },
  ];

  return (
    <>
      <div className="mb-8">
        <p className="text-muted-foreground">{new Date().toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="text-4xl">{t("todayTasks")}</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ to, icon: Icon, title, value, sub }) => (
          <Link key={to} to={to} className="card-soft group p-6 transition-transform hover:-translate-y-0.5">
            <div className="mb-6 flex items-center gap-2 text-muted-foreground">
              <span className="rounded-full bg-secondary p-2 text-foreground"><Icon className="size-4" /></span>
              {title}
            </div>
            <div className="font-display text-3xl">{value}</div>
            {sub && <div className="mt-1 text-sm text-muted-foreground">{sub}</div>}
          </Link>
        ))}
      </div>
    </>
  );
}
