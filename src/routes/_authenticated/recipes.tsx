import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, Pencil, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useRows, useTableMutations, type Row } from "@/lib/data";
import { PageHeader, ListState } from "@/components/PageHeader";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { FormDialog, Field } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/recipes")({
  head: () => ({ meta: [{ title: "Recipes — Nest" }, { name: "description", content: "Your saved family recipes." }] }),
  component: Recipes,
});

type RecipeValues = { title: string; ingredients: string; steps: string; minutes: number | null };

function Recipes() {
  const { t } = useLang();
  const query = useRows("recipes");
  const rows = query.data ?? [];
  const { add, update, remove } = useTableMutations("recipes");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Row<"recipes"> | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const current = rows.find((r) => r.id === openId);
  const ingredientsLabel = t("ingredients").split(" (")[0];

  return (
    <>
      <PageHeader title={t("recipes")}>
        <Button className="rounded-full" onClick={() => setAdding(true)}>{t("newRecipe")}</Button>
      </PageHeader>

      <ListState query={query} isEmpty={rows.length === 0}>
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((r) => (
            <button key={r.id} onClick={() => setOpenId(r.id)} className="card-soft p-6 text-start transition-transform hover:-translate-y-0.5">
              <h3 className="text-2xl">{r.title}</h3>
              <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                {r.minutes && <span className="flex items-center gap-1"><Clock className="size-3.5" />{r.minutes} {t("min")}</span>}
                <span>{r.ingredients.split("\n").filter(Boolean).length} · {ingredientsLabel}</span>
              </div>
            </button>
          ))}
        </div>
      </ListState>

      <Dialog open={!!current} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {current && (
            <>
              <DialogHeader><DialogTitle className="font-display text-3xl">{current.title}</DialogTitle></DialogHeader>
              <h4 className="font-medium">{ingredientsLabel}</h4>
              <ul className="list-disc space-y-1 ps-5 text-sm">
                {current.ingredients.split("\n").filter(Boolean).map((i, n) => <li key={n}>{i}</li>)}
              </ul>
              <h4 className="font-medium">{t("steps")}</h4>
              <p className="whitespace-pre-wrap text-sm">{current.steps}</p>
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => { setEditing(current); setOpenId(null); }}>
                  <Pencil /> {t("edit")}
                </Button>
                <ConfirmDelete name={current.title} onConfirm={() => { remove.mutate(current.id); setOpenId(null); }}>
                  <Button variant="ghost" className="text-destructive">
                    <Trash2 /> {t("delete")}
                  </Button>
                </ConfirmDelete>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {adding && (
        <RecipeForm title={t("newRecipe")} submitLabel={t("add")} onClose={() => setAdding(false)}
          onSave={(values) => add.mutate(values, { onSuccess: () => setAdding(false) })} />
      )}
      {editing && (
        <RecipeForm key={editing.id} title={t("edit")} recipe={editing} onClose={() => setEditing(null)}
          onSave={(values) => update.mutate({ id: editing.id, values }, { onSuccess: () => setEditing(null) })} />
      )}
    </>
  );
}

function RecipeForm({ title: dialogTitle, recipe, submitLabel, onClose, onSave }: {
  title: string;
  recipe?: Row<"recipes">;
  submitLabel?: string;
  onClose: () => void;
  onSave: (v: RecipeValues) => void;
}) {
  const { t } = useLang();
  const [title, setTitle] = useState(recipe?.title ?? "");
  const [minutes, setMinutes] = useState(recipe?.minutes ? String(recipe.minutes) : "");
  const [ingredients, setIngredients] = useState(recipe?.ingredients ?? "");
  const [steps, setSteps] = useState(recipe?.steps ?? "");
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={dialogTitle} submitLabel={submitLabel}
      onSubmit={() => title.trim() && onSave({
        title: title.trim(), ingredients, steps, minutes: Number(minutes) > 0 ? Math.round(Number(minutes)) : null,
      })}>
      <Field id="recipe-title" label={t("title")}>
        <Input id="recipe-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field id="recipe-minutes" label={t("minutes")}>
        <Input id="recipe-minutes" type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
      </Field>
      <Field id="recipe-ingredients" label={t("ingredients")}>
        <Textarea id="recipe-ingredients" rows={5} value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
      </Field>
      <Field id="recipe-steps" label={t("steps")}>
        <Textarea id="recipe-steps" rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} />
      </Field>
    </FormDialog>
  );
}
