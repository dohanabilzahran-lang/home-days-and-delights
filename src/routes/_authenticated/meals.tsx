import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, ShoppingBasket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLang, type Key } from "@/lib/i18n";
import { todayISO, useRows, useTableMutations, type Row } from "@/lib/data";
import { addDays } from "@/lib/recurrence";
import { consolidate, nameKey, SLOTS, weekDates, weekStart, type Slot } from "@/lib/meals";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { FormDialog, Field } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/meals")({
  head: () => ({ meta: [{ title: "Meal plan — Nest" }, { name: "description", content: "Weekly meal plan with lunchboxes and shopping suggestions." }] }),
  component: Meals,
});

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
type Entry = Row<"meal_plan_entries">;
type Draft = { id?: string; on_date: string; slot: Slot; recipe_id: string; title: string; child_id: string };

function useDayName() {
  const { lang } = useLang();
  return (date: string, style: "short" | "long" = "short") =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB",
      style === "short" ? { weekday: "short", day: "numeric", timeZone: "UTC" } : { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

function Meals() {
  const { t } = useLang();
  const dayName = useDayName();
  const today = todayISO();
  const [start, setStart] = useState(weekStart(today));
  const [view, setView] = useState<"week" | "day">("week");
  const [day, setDay] = useState(today);
  const entries = useRows("meal_plan_entries").data ?? [];
  const recipes = useRows("recipes").data ?? [];
  const children = useRows("children").data ?? [];
  const { add, update, remove } = useTableMutations("meal_plan_entries");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const dates = weekDates(start);
  const inWeek = entries.filter((e) => e.on_date >= start && e.on_date <= dates[6]!);
  const cell = (date: string, slot: Slot) => inWeek.filter((e) => e.on_date === date && e.slot === slot);
  const label = (e: Entry) => {
    const name = e.recipe_id ? recipes.find((r) => r.id === e.recipe_id)?.title ?? e.title ?? "—" : e.title ?? "—";
    const child = e.child_id ? children.find((c) => c.id === e.child_id)?.name : null;
    return child ? `${name} · ${child}` : name;
  };
  const open = (e: Entry) =>
    setDraft({ id: e.id, on_date: e.on_date, slot: e.slot as Slot, recipe_id: e.recipe_id ?? "", title: e.title ?? "", child_id: e.child_id ?? "" });
  const blank = (date: string, slot: Slot) => setDraft({ on_date: date, slot, recipe_id: "", title: "", child_id: "" });

  function save(d: Draft) {
    if (!d.recipe_id && !d.title.trim()) return;
    const values = {
      on_date: d.on_date, slot: d.slot, recipe_id: d.recipe_id || null, title: d.recipe_id ? null : d.title.trim(), child_id: d.child_id || null,
    };
    if (d.id) update.mutate({ id: d.id, values }, { onSuccess: () => setDraft(null) });
    else add.mutate(values, { onSuccess: () => setDraft(null) });
  }

  const Chip = ({ e }: { e: Entry }) => (
    <button type="button" onClick={() => open(e)} className="w-full rounded-lg bg-secondary px-2 py-1 text-start text-xs hover:ring-1 hover:ring-primary">
      {label(e)}
    </button>
  );

  return (
    <>
      <PageHeader title={t("meals")}>
        <Button variant="outline" className="rounded-full" onClick={() => setSuggesting(true)}>
          <ShoppingBasket className="size-4" /> {t("shoppingSuggestions")}
        </Button>
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full border border-border p-1">
          <Button variant="ghost" size="icon" className="rounded-full" aria-label={t("prevWeek")} onClick={() => setStart(addDays(start, -7))}>
            <ChevronLeft className="size-4 rtl:rotate-180" />
          </Button>
          <button type="button" className="min-w-36 px-2 text-center text-sm font-medium" onClick={() => setStart(weekStart(today))}>
            {start === weekStart(today) ? t("thisWeek") : `${dayName(dates[0]!)} – ${dayName(dates[6]!)}`}
          </button>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label={t("nextWeek")} onClick={() => setStart(addDays(start, 7))}>
            <ChevronRight className="size-4 rtl:rotate-180" />
          </Button>
        </div>
        <div className="flex rounded-full bg-muted p-1" role="radiogroup">
          {(["week", "day"] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)}
              className={`rounded-full px-4 py-1.5 text-sm ${view === v ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
              {v === "week" ? t("thisWeek").split(" ").pop() : t("day")}
            </button>
          ))}
        </div>
      </div>

      {view === "week" ? (
        <div className="card-soft overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-24 p-2" />
                {dates.map((d) => (
                  <th key={d} className="p-2 text-start font-medium">
                    <button type="button" onClick={() => { setDay(d); setView("day"); }}
                      className={`rounded-full px-2 py-0.5 ${d === today ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
                      {dayName(d)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map((slot) => (
                <tr key={slot} className="border-t border-border align-top">
                  <th scope="row" className="p-2 text-start text-xs font-medium text-muted-foreground">{t(`slot_${slot}` as Key)}</th>
                  {dates.map((d) => (
                    <td key={d} className="space-y-1 p-1.5">
                      {cell(d, slot).map((e) => <Chip key={e.id} e={e} />)}
                      <button type="button" aria-label={t("addMeal", { slot: t(`slot_${slot}` as Key) })} onClick={() => blank(d, slot)}
                        className="flex w-full justify-center rounded-lg border border-dashed border-border py-0.5 text-muted-foreground hover:border-primary">
                        <Plus className="size-3.5" />
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {dates.map((d) => (
              <button key={d} type="button" aria-pressed={d === day} onClick={() => setDay(d)}
                className={`rounded-full border px-3 py-1 text-xs ${d === day ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                {dayName(d)}
              </button>
            ))}
          </div>
          <section className="card-soft divide-y divide-border">
            <h2 className="p-5 text-2xl">{dayName(day, "long")}</h2>
            {SLOTS.map((slot) => (
              <div key={slot} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-start">
                <div className="w-32 shrink-0 text-sm font-medium text-muted-foreground">{t(`slot_${slot}` as Key)}</div>
                <div className="flex flex-1 flex-col gap-1.5">
                  {entries.filter((e) => e.on_date === day && e.slot === slot).map((e) => <Chip key={e.id} e={e} />)}
                  <button type="button" onClick={() => blank(day, slot)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <Plus className="size-3.5" /> {t("addMeal", { slot: t(`slot_${slot}` as Key) })}
                  </button>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {draft && (
        <EntryDialog draft={draft} recipes={recipes} children={children} dates={dates} onClose={() => setDraft(null)} onSave={save}
          onRepeat={() => {
            if (!draft.id) return;
            add.mutate({
              on_date: addDays(draft.on_date, 7), slot: draft.slot, recipe_id: draft.recipe_id || null,
              title: draft.recipe_id ? null : draft.title.trim() || null, child_id: draft.child_id || null,
            }, { onSuccess: () => setDraft(null) });
          }}
          onDelete={() => draft.id && remove.mutate(draft.id, { onSuccess: () => setDraft(null) })} />
      )}
      {suggesting && <SuggestionsDialog weekEntries={inWeek} recipes={recipes} onClose={() => setSuggesting(false)} />}
    </>
  );
}

function EntryDialog({ draft, recipes, children, dates, onClose, onSave, onRepeat, onDelete }: {
  draft: Draft;
  recipes: Row<"recipes">[];
  children: Row<"children">[];
  dates: string[];
  onClose: () => void;
  onSave: (d: Draft) => void;
  onRepeat: () => void;
  onDelete: () => void;
}) {
  const { t } = useLang();
  const dayName = useDayName();
  const [d, setD] = useState(draft);
  const dayOptions = dates.includes(d.on_date) ? dates : [d.on_date, ...dates];
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={draft.id ? t("moveOrReplace") : t("addMeal", { slot: t(`slot_${draft.slot}` as Key) })}
      onSubmit={() => onSave(d)}>
      <Field id="meal-recipe" label={t("fromRecipe")}>
        <select id="meal-recipe" className={selectClass} value={d.recipe_id} onChange={(e) => setD({ ...d, recipe_id: e.target.value })}>
          <option value="">—</option>
          {recipes.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
        </select>
      </Field>
      {!d.recipe_id && (
        <Field id="meal-title" label={t("orWriteMeal")}>
          <Input id="meal-title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field id="meal-day" label={t("day")}>
          <select id="meal-day" className={selectClass} value={d.on_date} onChange={(e) => setD({ ...d, on_date: e.target.value })}>
            {dayOptions.map((x) => <option key={x} value={x}>{dayName(x)}</option>)}
          </select>
        </Field>
        <Field id="meal-slot" label={t("slot")}>
          <select id="meal-slot" className={selectClass} value={d.slot} onChange={(e) => setD({ ...d, slot: e.target.value as Slot })}>
            {SLOTS.map((s) => <option key={s} value={s}>{t(`slot_${s}` as Key)}</option>)}
          </select>
        </Field>
      </div>
      {children.length > 0 && (
        <Field id="meal-child" label={t("forChild")}>
          <select id="meal-child" className={selectClass} value={d.child_id} onChange={(e) => setD({ ...d, child_id: e.target.value })}>
            <option value="">{t("everyone")}</option>
            {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}
      {draft.id && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onRepeat}>{t("repeatNextWeek")}</Button>
          <ConfirmDelete name={t("meal")} onConfirm={onDelete}>
            <Button type="button" variant="ghost" className="text-destructive">{t("delete")}</Button>
          </ConfirmDelete>
        </div>
      )}
    </FormDialog>
  );
}

/** Review consolidated ingredients for the week, then add only the chosen ones. Manual items are never touched. */
function SuggestionsDialog({ weekEntries, recipes, onClose }: { weekEntries: Entry[]; recipes: Row<"recipes">[]; onClose: () => void }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const ingredients = useRows("recipe_ingredients").data ?? [];
  const items = useRows("shopping_items").data ?? [];
  const prices = useRows("item_prices").data ?? [];
  const suggestions = consolidate(
    weekEntries,
    recipes,
    ingredients.map((i) => ({ ...i, quantity: i.quantity === null ? null : Number(i.quantity) })),
    items.filter((i) => i.status === "needed").map((i) => i.name),
  );
  const [chosen, setChosen] = useState<Set<string>>(new Set(suggestions.filter((s) => !s.onList).map((s) => s.key)));
  const [busy, setBusy] = useState(false);

  async function addChosen() {
    const rows = suggestions.filter((s) => chosen.has(s.key)).map((s) => ({
      name: s.name, quantity: s.quantity, unit: s.unit, origin: "recipe", category: "other",
      estimated_price: prices.find((p) => p.name_key === nameKey(s.name))?.last_price ?? null,
    }));
    if (!rows.length) return onClose();
    setBusy(true);
    const { error } = await supabase.from("shopping_items").insert(rows);
    setBusy(false);
    if (error) return toast.error(t("saveFailed"), { description: error.message });
    qc.invalidateQueries({ queryKey: ["shopping_items"] });
    toast.success(t("addedToList"));
    onClose();
  }

  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("shoppingSuggestions")}
      submitLabel={busy ? "…" : t("addChosen", { n: chosen.size })} onSubmit={addChosen}>
      <p className="text-sm text-muted-foreground">{t("suggestionsIntro")}</p>
      {suggestions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t("noSuggestions")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {suggestions.map((s) => (
            <li key={s.key}>
              <label className="flex items-start gap-3 px-3 py-2.5 text-sm">
                <input type="checkbox" className="mt-0.5 size-4" checked={chosen.has(s.key)}
                  onChange={() => setChosen((c) => { const n = new Set(c); if (n.has(s.key)) n.delete(s.key); else n.add(s.key); return n; })} />
                <span className="flex-1">
                  <span className="font-medium">{[s.quantity, s.unit, s.name].filter((x) => x !== null && x !== "").join(" ")}</span>
                  <span className="block text-xs text-muted-foreground">{s.recipes.join(" · ")}</span>
                </span>
                {s.onList && <span className="text-xs text-muted-foreground">{t("alreadyOnList")}</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
    </FormDialog>
  );
}
