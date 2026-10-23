import { Check, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useLang } from "@/lib/i18n";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export function CheckRow({ done, onToggle, onDelete, onEdit, title, meta, right }: {
  done: boolean; onToggle: () => void; onDelete: () => void; onEdit?: () => void; title: string; meta?: ReactNode; right?: ReactNode;
}) {
  const { t } = useLang();
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        aria-label={t(done ? "markNotDoneLabel" : "markDoneLabel", { name: title })}
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${done ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-accent"}`}
      >
        {done && <Check className="size-3.5" />}
      </button>
      <div className="flex-1">
        <div className={done ? "text-muted-foreground line-through" : "font-medium"}>{title}</div>
        {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
      </div>
      {right}
      {onEdit && (
        <button type="button" onClick={onEdit} aria-label={t("editLabel", { name: title })} className="text-muted-foreground hover:text-foreground">
          <Pencil className="size-4" />
        </button>
      )}
      <ConfirmDelete name={title} onConfirm={onDelete}>
        <button type="button" aria-label={t("deleteLabel", { name: title })} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="size-4" />
        </button>
      </ConfirmDelete>
    </li>
  );
}
