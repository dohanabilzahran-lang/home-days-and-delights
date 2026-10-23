import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Sun, Moon } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { todayISO, useRows, useTableMutations, useToggleDone, type Row } from "@/lib/data";
import { FormDialog, Field } from "@/components/FormDialog";
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
  const { add, update, remove } = useTableMutations("skincare_steps");
  const toggleDone = useToggleDone("skincare_steps");
  const today = todayISO();
  const [editing, setEditing] = useState<Row<"skincare_steps"> | null>(null);

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
                      onEdit={() => setEditing(r)}
                      onDelete={() => remove.mutate(r.id)} />
                  ))}
                </ul>
              </ListState>
            </section>
          );
        })}
      </div>
      {editing && (
        <EditStep key={editing.id} step={editing} onClose={() => setEditing(null)}
          onSave={(values) => update.mutate({ id: editing.id, values }, { onSuccess: () => setEditing(null) })} />
      )}
    </>
  );
}

function EditStep({ step, onClose, onSave }: {
  step: Row<"skincare_steps">;
  onClose: () => void;
  onSave: (v: { title: string; product: string | null; period: string }) => void;
}) {
  const { t } = useLang();
  const [title, setTitle] = useState(step.title);
  const [product, setProduct] = useState(step.product ?? "");
  const [period, setPeriod] = useState(step.period);
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("edit")}
      onSubmit={() => title.trim() && onSave({ title: title.trim(), product: product.trim() || null, period })}>
      <Field id="edit-step-title" label={t("step")}>
        <Input id="edit-step-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field id="edit-step-product" label={t("product")}>
        <Input id="edit-step-product" value={product} onChange={(e) => setProduct(e.target.value)} />
      </Field>
      <Field id="edit-step-period" label={t("time")}>
        <select id="edit-step-period" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="morning">{t("morning")}</option>
          <option value="evening">{t("evening")}</option>
        </select>
      </Field>
    </FormDialog>
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
      <Input aria-label={t("step")} placeholder={t("step")} value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input aria-label={t("product")} placeholder={t("product")} value={product} onChange={(e) => setProduct(e.target.value)} />
      <Button type="submit" className="rounded-full">{t("add")}</Button>
    </form>
  );
}
