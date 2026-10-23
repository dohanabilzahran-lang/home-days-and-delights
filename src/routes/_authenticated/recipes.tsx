import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Pencil, Trash2, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { useRows, useTableMutations, type Row } from "@/lib/data";
import { parseIngredient } from "@/lib/meals";
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

type RecipeValues = { title: string; ingredients: string; steps: string; minutes: number | null; kind: "full" | "quick"; servings: number | null };

/**
 * Saves a recipe and its ingredient list. Each ingredient line is also stored as a structured row
 * (quantity, unit, name) so the meal plan can turn it into shopping suggestions.
 */
function useSaveRecipe() {
  const qc = useQueryClient();
  const { t } = useLang();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: RecipeValues }) => {
      let recipeId = id;
      if (recipeId) {
        const { error } = await supabase.from("recipes").update(values).eq("id", recipeId);
        if (error) throw error;
        const del = await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId);
        if (del.error) throw del.error;
      } else {
        const { data, error } = await supabase.from("recipes").insert(values).select("id").single();
        if (error) throw error;
        recipeId = data.id;
      }
      const rows = values.ingredients
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line, position) => ({ ...parseIngredient(line), recipe_id: recipeId as string, position }));
      if (rows.length) {
        const ins = await supabase.from("recipe_ingredients").insert(rows);
        if (ins.error) throw ins.error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.invalidateQueries({ queryKey: ["recipe_ingredients"] });
    },
    onError: (e) => toast.error(t("saveFailed"), { description: e instanceof Error ? e.message : undefined }),
  });
}

function Recipes() {
  const { t } = useLang();
  const query = useRows("recipes");
  const rows = query.data ?? [];
  const { remove } = useTableMutations("recipes");
  const save = useSaveRecipe();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Row<"recipes"> | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "full" | "quick">("all");

  const current = rows.find((r) => r.id === openId);
  const ingredientsLabel = t("ingredients").split(" (")[0];
  const visible = rows.filter((r) => filter === "all" || r.kind === filter);

  return (
    <>
      <PageHeader title={t("recipes")}>
        <Button className="rounded-full" onClick={() => setAdding(true)}>{t("newRecipe")}</Button>
      </PageHeader>

      <div className="mb-5 flex flex-wrap gap-2">
        {(["all", "full", "quick"] as const).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
            {f === "all" ? t("allProjects") : f === "full" ? t("kind_full") : t("kind_quick")}
          </button>
        ))}
      </div>

      <ListState query={query} isEmpty={visible.length === 0}>
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((r) => (
            <button key={r.id} onClick={() => setOpenId(r.id)} className="card-soft p-6 text-start transition-transform hover:-translate-y-0.5">
              <h3 className="text-2xl">{r.title}</h3>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {r.kind === "quick" && <span className="flex items-center gap-1"><Zap className="size-3.5" />{t("quick")}</span>}
                {r.minutes && <span className="flex items-center gap-1"><Clock className="size-3.5" />{r.minutes} {t("min")}</span>}
                {r.servings && <span className="flex items-center gap-1"><Users className="size-3.5" />{r.servings}</span>}
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
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>{current.kind === "quick" ? t("kind_quick") : t("kind_full")}</span>
                {current.minutes && <span>{current.minutes} {t("min")}</span>}
                {current.servings && <span>{t("servings")}: {current.servings}</span>}
              </div>
              <h4 className="font-medium">{ingredientsLabel}</h4>
              <ul className="list-disc space-y-1 ps-5 text-sm">
                {current.ingredients.split("\n").filter(Boolean).map((i, n) => <li key={n}>{i}</li>)}
              </ul>
              {current.steps && (
                <>
                  <h4 className="font-medium">{t("steps")}</h4>
                  <p className="whitespace-pre-wrap text-sm">{current.steps}</p>
                </>
              )}
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
          onSave={(values) => save.mutate({ values }, { onSuccess: () => setAdding(false) })} />
      )}
      {editing && (
        <RecipeForm key={editing.id} title={t("edit")} recipe={editing} onClose={() => setEditing(null)}
          onSave={(values) => save.mutate({ id: editing.id, values }, { onSuccess: () => setEditing(null) })} />
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
  const [kind, setKind] = useState<"full" | "quick">(recipe?.kind === "quick" ? "quick" : "full");
  const [minutes, setMinutes] = useState(recipe?.minutes ? String(recipe.minutes) : "");
  const [servings, setServings] = useState(recipe?.servings ? String(recipe.servings) : "");
  const [ingredients, setIngredients] = useState(recipe?.ingredients ?? "");
  const [steps, setSteps] = useState(recipe?.steps ?? "");
  const positive = (v: string) => (Number(v) > 0 ? Math.round(Number(v)) : null);
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={dialogTitle} submitLabel={submitLabel}
      onSubmit={() => title.trim() && onSave({
        title: title.trim(), kind, ingredients, steps, minutes: positive(minutes), servings: positive(servings),
      })}>
      <Field id="recipe-title" label={t("title")}>
        <Input id="recipe-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field id="recipe-kind" label={t("recipeKind")}>
          <select id="recipe-kind" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={kind} onChange={(e) => setKind(e.target.value as "full" | "quick")}>
            <option value="full">{t("kind_full")}</option>
            <option value="quick">{t("kind_quick")}</option>
          </select>
        </Field>
        <Field id="recipe-minutes" label={t("minutes")}>
          <Input id="recipe-minutes" type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </Field>
        <Field id="recipe-servings" label={t("servings")}>
          <Input id="recipe-servings" type="number" min={1} value={servings} onChange={(e) => setServings(e.target.value)} />
        </Field>
      </div>
      <Field id="recipe-ingredients" label={t("ingredients")}>
        <Textarea id="recipe-ingredients" rows={5} placeholder={t("ingredientsHint")} value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
      </Field>
      <Field id="recipe-steps" label={t("steps")}>
        <Textarea id="recipe-steps" rows={kind === "quick" ? 3 : 6} value={steps} onChange={(e) => setSteps(e.target.value)} />
      </Field>
    </FormDialog>
  );
}
