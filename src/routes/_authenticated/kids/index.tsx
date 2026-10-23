import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { todayISO, useHistory, useRows, useTableMutations } from "@/lib/data";
import { dailyStatus } from "@/lib/recurrence";
import { PageHeader } from "@/components/PageHeader";
import { FormDialog, Field } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/kids/")({
  head: () => ({ meta: [{ title: "Kids — Nest" }, { name: "description", content: "Each child's daily routine." }] }),
  component: Kids,
});

function Kids() {
  const { t } = useLang();
  const childrenQuery = useRows("children");
  const children = childrenQuery.data ?? [];
  const tasks = useRows("kids_tasks").data ?? [];
  const history = useHistory("kids").data;
  const { add } = useTableMutations("children");
  const today = todayISO();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function addChild() {
    const n = name.trim();
    if (!n) return;
    add.mutate({ name: n, position: children.length }, { onSuccess: () => { setName(""); setOpen(false); } });
  }

  return (
    <>
      <PageHeader title={t("kids")}>
        <Button className="rounded-full" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> {t("addChild")}
        </Button>
      </PageHeader>

      {childrenQuery.isPending ? (
        <p role="status" className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">{t("loading")}</p>
      ) : childrenQuery.isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-destructive/40 p-8 text-center">
          <p className="text-destructive">{t("loadFailed")}</p>
          <Button variant="outline" className="rounded-full" onClick={() => childrenQuery.refetch()}>{t("retry")}</Button>
        </div>
      ) : children.length === 0 ? (
        <button type="button" onClick={() => setOpen(true)}
          className="w-full rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground hover:border-primary">
          {t("noChildren")}
        </button>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map((c) => {
            // Only items scheduled for today count; skipped and postponed ones drop out of the total.
            const statuses = tasks.filter((k) => k.child_id === c.id).map((k) => dailyStatus(k, history, today));
            const mine = statuses.filter((s) => s === "due" || s === "done");
            const done = statuses.filter((s) => s === "done").length;
            return (
              <Link key={c.id} to="/kids/$childId" params={{ childId: c.id }}
                className="card-soft flex flex-col gap-4 p-6 transition-transform hover:-translate-y-0.5">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-full bg-secondary font-display text-xl">
                    {c.name.slice(0, 1)}
                  </span>
                  <h2 className="text-2xl">{c.name}</h2>
                </div>
                <div className="space-y-1.5">
                  <div className="text-sm text-muted-foreground">{t("doneOf", { a: done, b: mine.length })}</div>
                  <Progress value={mine.length ? (done / mine.length) * 100 : 0} className="h-2" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <FormDialog open={open} onOpenChange={setOpen} title={t("addChild")} onSubmit={addChild} submitLabel={t("add")}>
        <Field id="new-child" label={t("childName")}>
          <Input id="new-child" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </FormDialog>
    </>
  );
}
