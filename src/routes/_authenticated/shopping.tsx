import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLang, type Key } from "@/lib/i18n";
import { formatMoney, todayISO, useRows, useTableMutations, type Row } from "@/lib/data";
import { nameKey } from "@/lib/meals";
import { PageHeader, ListState } from "@/components/PageHeader";
import { CheckRow, Pill } from "@/components/CheckRow";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { FormDialog, Field } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/shopping")({
  head: () => ({ meta: [{ title: "Shopping — Nest" }, { name: "description", content: "Shopping list linked to your budget." }] }),
  component: Shopping,
});

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
const BUILT_IN = ["produce", "dairy", "meat", "bakery", "pantry", "frozen", "household", "personal", "other"] as const;
const NEW = "__new__";
type Item = Row<"shopping_items">;

function useCategories() {
  const { t } = useLang();
  const custom = useRows("shopping_categories").data ?? [];
  const list = [
    ...BUILT_IN.map((k) => ({ value: k as string, label: t(`shop_${k}` as Key) })),
    ...custom.map((c) => ({ value: `custom:${c.name}`, label: c.name })),
  ];
  const labelOf = (v: string) => list.find((c) => c.value === v)?.label ?? (v.startsWith("custom:") ? v.slice(7) : t("shop_other"));
  return { list, labelOf };
}

/** Marks an item bought and records the expense once (the database refuses a second record). */
function useBuy() {
  const qc = useQueryClient();
  const { t } = useLang();
  return useMutation({
    mutationFn: async ({ id, price, toBudget }: { id: string; price: number; toBudget: boolean }) => {
      if (toBudget) {
        const { error } = await supabase.rpc("record_purchase", { p_item_id: id, p_price: price, p_on: todayISO() });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shopping_items")
          .update({ status: "bought", bought_on: todayISO(), actual_price: price > 0 ? price : null }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => ["shopping_items", "transactions", "item_prices"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
    onError: (e) => toast.error(t("saveFailed"), { description: e instanceof Error ? e.message : undefined }),
  });
}

function Shopping() {
  const { t, lang } = useLang();
  const query = useRows("shopping_items");
  const items = query.data ?? [];
  const prices = useRows("item_prices").data ?? [];
  const { add, update, remove } = useTableMutations("shopping_items");
  const catMut = useTableMutations("shopping_categories");
  const { list: categories, labelOf } = useCategories();
  const buy = useBuy();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState<string>("produce");
  const [newCat, setNewCat] = useState<string | null>(null);
  const [buying, setBuying] = useState<Item | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);

  const lastPrice = (n: string) => {
    const p = prices.find((x) => x.name_key === nameKey(n));
    return p ? Number(p.last_price) : null;
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    add.mutate({
      name: name.trim(), quantity: Number(qty) > 0 ? Number(qty) : null, unit: unit.trim() || null, category, origin: "manual",
      estimated_price: lastPrice(name),
    });
    setName("");
    setQty("");
    setUnit("");
  }

  const needed = items.filter((i) => i.status === "needed");
  const bought = items.filter((i) => i.status === "bought").sort((a, b) => (b.bought_on ?? "").localeCompare(a.bought_on ?? ""));
  const groups = categories
    .map((c) => ({ ...c, items: needed.filter((i) => i.category === c.value) }))
    .concat([{ value: "?", label: t("shop_other"), items: needed.filter((i) => !categories.some((c) => c.value === i.category)) }])
    .filter((g) => g.items.length > 0);
  const estimate = needed.reduce((s, i) => s + (i.estimated_price ? Number(i.estimated_price) : 0), 0);

  return (
    <>
      <PageHeader title={t("shopping")} subtitle={estimate > 0 ? t("estimatedTotal", { a: formatMoney(estimate, lang) }) : undefined} />

      <form onSubmit={submit} className="card-soft mb-6 grid gap-3 p-5 sm:grid-cols-[2fr_0.6fr_0.8fr_1.2fr_auto]">
        <Input aria-label={t("item")} placeholder={t("item")} value={name} onChange={(e) => setName(e.target.value)} />
        <Input aria-label={t("quantity")} placeholder={t("quantity")} type="number" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
        <Input aria-label={t("unit")} placeholder={t("unit")} value={unit} onChange={(e) => setUnit(e.target.value)} />
        <select aria-label={t("category")} className={selectClass} value={category}
          onChange={(e) => (e.target.value === NEW ? setNewCat("") : setCategory(e.target.value))}>
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          <option value={NEW}>{t("newCategory")}</option>
        </select>
        <Button type="submit" className="rounded-full">{t("add")}</Button>
      </form>

      <ListState query={query} isEmpty={items.length === 0}>
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.value}>
              <h2 className="mb-3 text-2xl">{g.label}</h2>
              <ul className="card-soft divide-y divide-border">
                {g.items.map((i) => (
                  <CheckRow key={i.id} title={i.name} done={false}
                    meta={[[i.quantity, i.unit].filter(Boolean).join(" "), i.origin === "recipe" ? t("fromRecipes") : null].filter(Boolean).join(" · ")}
                    right={i.estimated_price ? <span className="text-xs tabular-nums text-muted-foreground">{t("estimate", { a: formatMoney(Number(i.estimated_price), lang) })}</span> : null}
                    onToggle={() => setBuying(i)}
                    onEdit={() => setEditing(i)}
                    onDelete={() => remove.mutate(i.id)} />
                ))}
              </ul>
            </section>
          ))}

          {bought.length > 0 && (
            <section>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-2xl">{t("bought")}</h2>
                <ConfirmDelete name={t("clearBought")} onConfirm={async () => {
                  const { error } = await supabase.from("shopping_items").delete().eq("status", "bought");
                  if (error) toast.error(t("saveFailed"), { description: error.message });
                  else query.refetch();
                }}>
                  <Button variant="ghost" size="sm" className="text-muted-foreground">{t("clearBought")}</Button>
                </ConfirmDelete>
              </div>
              <ul className="card-soft divide-y divide-border">
                {bought.map((i) => (
                  <CheckRow key={i.id} title={i.name} done muted
                    meta={[i.bought_on, i.actual_price ? formatMoney(Number(i.actual_price), lang) : null].filter(Boolean).join(" · ")}
                    right={i.transaction_id ? <Pill>{t("inBudget")}</Pill> : null}
                    // A purchase already in the budget stays bought, so the expense is never orphaned.
                    onToggle={() => !i.transaction_id && update.mutate({ id: i.id, values: { status: "needed", bought_on: null, actual_price: null } })}
                    onDelete={() => remove.mutate(i.id)} />
                ))}
              </ul>
            </section>
          )}
        </div>
      </ListState>

      {buying && (
        <BuyDialog item={buying} last={lastPrice(buying.name)} busy={buy.isPending} onClose={() => setBuying(null)}
          onBuy={(price, toBudget) => buy.mutate({ id: buying.id, price, toBudget }, { onSuccess: () => setBuying(null) })} />
      )}
      {editing && (
        <EditItem key={editing.id} item={editing} categories={categories} labelOf={labelOf} onClose={() => setEditing(null)}
          onSave={(values) => update.mutate({ id: editing.id, values }, { onSuccess: () => setEditing(null) })} />
      )}
      <FormDialog open={newCat !== null} onOpenChange={(o) => !o && setNewCat(null)} title={t("newCategory").replace(/[+…]/g, "").trim()}
        onSubmit={() => {
          const n = newCat?.trim();
          if (n) catMut.add.mutate({ name: n }, { onSuccess: () => { setCategory(`custom:${n}`); setNewCat(null); } });
        }}>
        <Field id="new-cat" label={t("categoryName")}>
          <Input id="new-cat" value={newCat ?? ""} onChange={(e) => setNewCat(e.target.value)} />
        </Field>
      </FormDialog>
    </>
  );
}

function BuyDialog({ item, last, busy, onClose, onBuy }: {
  item: Item; last: number | null; busy: boolean; onClose: () => void; onBuy: (price: number, toBudget: boolean) => void;
}) {
  const { t, lang } = useLang();
  const start = item.estimated_price ?? last;
  const [price, setPrice] = useState(start ? String(start) : "");
  const valid = Number(price) > 0;
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={`${t("markBought")}: ${item.name}`}
      submitLabel={t("addToBudget")} onSubmit={() => valid && !busy && onBuy(Number(price), true)}>
      <Field id="buy-price" label={t("pricePaid")}>
        <Input id="buy-price" type="number" min={0} step="any" value={price} onChange={(e) => setPrice(e.target.value)} />
      </Field>
      {last !== null && <p className="text-xs text-muted-foreground">{t("lastPriceHint", { a: formatMoney(last, lang) })}</p>}
      <Button type="button" variant="outline" className="w-full rounded-full" disabled={busy} onClick={() => onBuy(Number(price) || 0, false)}>
        {t("boughtNoBudget")}
      </Button>
    </FormDialog>
  );
}

function EditItem({ item, categories, labelOf, onClose, onSave }: {
  item: Item;
  categories: { value: string; label: string }[];
  labelOf: (v: string) => string;
  onClose: () => void;
  onSave: (v: { name: string; quantity: number | null; unit: string | null; category: string; estimated_price: number | null }) => void;
}) {
  const { t } = useLang();
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.quantity ? String(item.quantity) : "");
  const [unit, setUnit] = useState(item.unit ?? "");
  const [category, setCategory] = useState(item.category);
  const [est, setEst] = useState(item.estimated_price ? String(item.estimated_price) : "");
  const options = categories.some((c) => c.value === category) ? categories : [...categories, { value: category, label: labelOf(category) }];
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("edit")}
      onSubmit={() => name.trim() && onSave({
        name: name.trim(), quantity: Number(qty) > 0 ? Number(qty) : null, unit: unit.trim() || null, category,
        estimated_price: Number(est) >= 0 && est !== "" ? Number(est) : null,
      })}>
      <Field id="shop-name" label={t("item")}>
        <Input id="shop-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="shop-qty" label={t("quantity")}>
          <Input id="shop-qty" type="number" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field id="shop-unit" label={t("unit")}>
          <Input id="shop-unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
      </div>
      <Field id="shop-cat" label={t("category")}>
        <select id="shop-cat" className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          {options.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Field>
      <Field id="shop-est" label={`${t("estimate", { a: "" }).trim()} EGP`}>
        <Input id="shop-est" type="number" min={0} step="any" value={est} onChange={(e) => setEst(e.target.value)} />
      </Field>
    </FormDialog>
  );
}
