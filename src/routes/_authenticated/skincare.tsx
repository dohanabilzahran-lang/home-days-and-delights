import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Sun, Moon } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { todayISO, useRows, useTableMutations, useToggleDone } from "@/lib/data";
import { PageHeader, ListState } from "@/components/PageHeader";
import { CheckRow } from "@/components/CheckRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/skincare")({
  head: () => ({ meta: [{ title: "Skincare — Nest" }, { name: "description", content: "Your morning and evening skincare routine." }] }),
  component: Skincare,
});

function Skincare() {
  const { t } = useLang();
  const query = useRows("skincare_steps");
  const rows = query.data ?? [];
  const { add, remove } = useTableMutations("skincare_steps");
  const toggleDone = useToggleDone("skincare_steps");
  const today = todayISO();

  return (
    <>
      <PageHeader title={t("skincare")} />
      <div className="grid gap-6 md:grid-cols-2">
        {(["morning", "evening"] as const).map((period) => {
          const list = rows.filter((r) => r.period === period);
          return (
            <section key={period}>
              <h2 className="mb-3 flex items-center gap-2 text-2xl">
                {period === "morning" ? <Sun className="size-5" /> : <Moon className="size-5" />} {t(period)}
              </h2>
              <AddStep onAdd={(title, product) => add.mutate({ title, product, period, position: list.length })} />
              <ListState query={query} isEmpty={list.length === 0}>
                <ul className="card-soft divide-y divide-border">
                  {list.map((r) => (
                    <CheckRow key={r.id} title={r.title} meta={r.product}
                      done={r.last_done === today}
                      onToggle={() => toggleDone(r, today)}
                      onDelete={() => remove.mutate(r.id)} />
                  ))}
                </ul>
              </ListState>
            </section>
          );
        })}
      </div>
    </>
  );
}

function AddStep({ onAdd }: { onAdd: (title: string, product: string | null) => void }) {
  const { t } = useLang();
  const [title, setTitle] = useState("");
  const [product, setProduct] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title) return;
    onAdd(title, product || null);
    setTitle("");
    setProduct("");
  }
  return (
    <form onSubmit={submit} className="mb-3 flex gap-2">
      <Input placeholder={t("step")} value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input placeholder={t("product")} value={product} onChange={(e) => setProduct(e.target.value)} />
      <Button type="submit" className="rounded-full">{t("add")}</Button>
    </form>
  );
}
