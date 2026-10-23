import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Clock, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useRows, useTableMutations } from "@/lib/data";
import { PageHeader, Empty } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/recipes")({
  head: () => ({ meta: [{ title: "Recipes — Nest" }, { name: "description", content: "Your saved family recipes." }] }),
  component: Recipes,
});

function Recipes() {
  const { t } = useLang();
  const { data: rows = [] } = useRows("recipes");
  const { add, remove } = useTableMutations("recipes");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [steps, setSteps] = useState("");
  const [minutes, setMinutes] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title) return;
    add.mutate({ title, ingredients, steps, minutes: minutes ? Number(minutes) : null }, {
      onSuccess: () => { setOpen(false); setTitle(""); setIngredients(""); setSteps(""); setMinutes(""); },
    });
  }

  const current = rows.find((r) => r.id === openId);

  return (
    <>
      <PageHeader title={t("recipes")}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="rounded-full">{t("newRecipe")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display text-2xl">{t("newRecipe")}</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <Input placeholder={t("title")} value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input type="number" placeholder={t("minutes")} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
              <Textarea rows={5} placeholder={t("ingredients")} value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
              <Textarea rows={5} placeholder={t("steps")} value={steps} onChange={(e) => setSteps(e.target.value)} />
              <Button type="submit" className="w-full rounded-full">{t("add")}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {rows.length === 0 ? <Empty text={t("empty")} /> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((r) => (
            <button key={r.id} onClick={() => setOpenId(r.id)} className="card-soft p-6 text-start transition-transform hover:-translate-y-0.5">
              <h3 className="text-2xl">{r.title}</h3>
              <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                {r.minutes && <span className="flex items-center gap-1"><Clock className="size-3.5" />{r.minutes} {t("min")}</span>}
                <span>{r.ingredients.split("\n").filter(Boolean).length} · {t("ingredients").split(" (")[0]}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!current} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {current && (
            <>
              <DialogHeader><DialogTitle className="font-display text-3xl">{current.title}</DialogTitle></DialogHeader>
              <h4 className="font-medium">{t("ingredients").split(" (")[0]}</h4>
              <ul className="list-disc space-y-1 ps-5 text-sm">
                {current.ingredients.split("\n").filter(Boolean).map((i, n) => <li key={n}>{i}</li>)}
              </ul>
              <h4 className="font-medium">{t("steps")}</h4>
              <p className="whitespace-pre-wrap text-sm">{current.steps}</p>
              <Button variant="ghost" className="justify-start text-destructive" onClick={() => { remove.mutate(current.id); setOpenId(null); }}>
                <Trash2 /> {t("delete")}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
