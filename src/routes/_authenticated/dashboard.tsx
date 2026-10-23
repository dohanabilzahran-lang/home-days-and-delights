import { createFileRoute, Link } from "@tanstack/react-router";
import { Wallet, Sparkles, Brush, Baby, Briefcase, ShoppingBasket, UtensilsCrossed, CalendarDays } from "lucide-react";
import type { ReactNode } from "react";
import { useLang, type Key } from "@/lib/i18n";
import { categoryKey, formatMoney, todayISO, useProfile, useRows } from "@/lib/data";
import { dailyStatus, diffDays, lastHandled, nextDueInterval } from "@/lib/recurrence";
import { monthOf, monthTotals } from "@/lib/budget";
import { SLOTS } from "@/lib/meals";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Today — Nest" }, { name: "description", content: "Your day at a glance." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { t, lang } = useLang();
  const today = todayISO();
  const history = useRows("completions").data ?? [];
  const cleaning = useRows("cleaning_tasks").data ?? [];
  const kids = useRows("kids_tasks").data ?? [];
  const skin = useRows("skincare_steps").data ?? [];
  const work = useRows("work_items").data ?? [];
  const events = (useRows("events").data ?? []).filter((e) => !e.deleted_at && e.starts_on === today);
  const shopping = (useRows("shopping_items").data ?? []).filter((i) => i.status === "needed");
  const meals = (useRows("meal_plan_entries").data ?? []).filter((m) => m.on_date === today);
  const recipes = useRows("recipes").data ?? [];
  const txs = useRows("transactions").data ?? [];
  const { income } = useProfile();
  const hist = (type: string) => history.filter((h) => h.source_type === type);

  // Cleaning: due or overdue now (not done today).
  const cleanInfo = cleaning.map((c) => {
    const days = diffDays(today, nextDueInterval(lastHandled(hist("cleaning"), c.id), c.every_days, c.snoozed_until, today));
    const doneToday = hist("cleaning").some((h) => h.source_id === c.id && h.on_date === today && h.status === "done");
    return { c, due: !doneToday && days <= 0 };
  });
  const cleanDue = cleanInfo.filter((x) => x.due);
  const homePct = cleaning.length ? Math.round(((cleaning.length - cleanDue.length) / cleaning.length) * 100) : 100;

  const progress = (rows: typeof kids | typeof skin, type: string) => {
    const st = rows.map((r) => dailyStatus(r, hist(type), today)).filter((s) => s === "due" || s === "done");
    return { done: st.filter((s) => s === "done").length, total: st.length };
  };
  const kidsP = progress(kids, "kids");
  const skinP = progress(skin, "skincare");
  const workDue = work.filter((w) => w.kind !== "note" && w.status !== "done" && w.due_date && w.due_date <= today);
  const month = monthTotals(txs, monthOf(today), categoryKey);
  const left = income + month.income - month.spent;
  const estimate = shopping.reduce((s, i) => s + (i.estimated_price ? Number(i.estimated_price) : 0), 0);

  // Today's plan: timed things first, then the rest.
  const plan = [
    ...events.map((e) => ({ key: `e${e.id}`, time: e.start_time?.slice(0, 5) ?? null, title: e.title, to: "/calendar" as const })),
    ...workDue.map((w) => ({ key: `w${w.id}`, time: w.due_date === today ? w.due_time?.slice(0, 5) ?? null : null, title: w.title, to: "/work" as const })),
    ...cleanDue.map(({ c }) => ({ key: `c${c.id}`, time: null, title: c.title, to: "/cleaning" as const })),
  ].sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));

  return (
    <>
      <div className="mb-8">
        <p className="text-muted-foreground">{new Date().toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="text-4xl">{t("todayTasks")}</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="card-soft p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-2xl"><CalendarDays className="size-5" /> {t("agendaToday")}</h2>
            <Link to="/calendar" className="text-sm text-muted-foreground hover:text-foreground">{t("calendar")} →</Link>
          </div>
          {plan.length === 0 ? <p className="text-muted-foreground">{t("nothingPlanned")}</p> : (
            <ul className="space-y-2">
              {plan.slice(0, 8).map((p) => (
                <li key={p.key}>
                  <Link to={p.to} className="flex items-baseline gap-3 rounded-lg px-2 py-1 hover:bg-secondary">
                    <span className="w-12 shrink-0 text-sm tabular-nums text-muted-foreground">{p.time ?? "·"}</span>
                    <span>{p.title}</span>
                  </Link>
                </li>
              ))}
              {plan.length > 8 && <li className="px-2 text-sm text-muted-foreground">{t("moreCount", { n: plan.length - 8 })}</li>}
            </ul>
          )}
          {meals.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground"><UtensilsCrossed className="size-4" /> {t("mealsToday")}</h3>
              <ul className="space-y-1 text-sm">
                {SLOTS.flatMap((s) => meals.filter((m) => m.slot === s)).map((m) => (
                  <li key={m.id} className="flex gap-3">
                    <span className="w-24 shrink-0 text-muted-foreground">{t(`slot_${m.slot}` as Key)}</span>
                    <span>{m.recipe_id ? recipes.find((r) => r.id === m.recipe_id)?.title : m.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card to="/cleaning" icon={<Brush className="size-4" />} title={t("cleaning")} value={t("tasksDue", { n: cleanDue.length })}>
            <Progress value={homePct} className="h-1.5" aria-label={t("homeProgress", { p: homePct })} />
          </Card>
          <Card to="/kids" icon={<Baby className="size-4" />} title={t("kids")} value={t("doneOf", { a: kidsP.done, b: kidsP.total })}>
            <Progress value={kidsP.total ? (kidsP.done / kidsP.total) * 100 : 0} className="h-1.5" aria-label={t("kids")} />
          </Card>
          <Card to="/skincare" icon={<Sparkles className="size-4" />} title={t("skincare")} value={t("doneOf", { a: skinP.done, b: skinP.total })}>
            <Progress value={skinP.total ? (skinP.done / skinP.total) * 100 : 0} className="h-1.5" aria-label={t("skincare")} />
          </Card>
          <Card to="/budget" icon={<Wallet className="size-4" />} title={t("budget")} value={formatMoney(left, lang)} sub={t("leftOfPlan")} warn={left < 0} />
          <Card to="/work" icon={<Briefcase className="size-4" />} title={t("work")} value={t("workDue", { n: workDue.length })} warn={workDue.length > 0} />
          <Card to="/shopping" icon={<ShoppingBasket className="size-4" />} title={t("shopping")} value={t("shoppingNeeded", { n: shopping.length })}
            sub={estimate > 0 ? t("estimate", { a: formatMoney(estimate, lang) }) : undefined} />
        </div>
      </div>
    </>
  );
}

function Card({ to, icon, title, value, sub, warn, children }: {
  to: "/cleaning" | "/kids" | "/skincare" | "/budget" | "/work" | "/shopping";
  icon: ReactNode; title: string; value: string; sub?: string | undefined; warn?: boolean; children?: ReactNode;
}) {
  return (
    <Link to={to} className="card-soft flex flex-col gap-3 p-5 transition-transform hover:-translate-y-0.5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="rounded-full bg-secondary p-1.5 text-foreground">{icon}</span>
        {title}
      </div>
      <div className={`font-display text-2xl tabular-nums ${warn ? "text-destructive" : ""}`}>{value}</div>
      {sub && <div className="-mt-2 text-xs text-muted-foreground">{sub}</div>}
      {children}
    </Link>
  );
}
