import { Check, MoreVertical, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useLang } from "@/lib/i18n";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type RowAction = { label: string; onSelect: () => void };

export function CheckRow({ done, onToggle, onDelete, onEdit, actions, title, meta, right, muted, children }: {
  done: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  actions?: RowAction[];
  title: string;
  meta?: ReactNode;
  right?: ReactNode;
  /** Dim the row (e.g. not scheduled today, skipped or postponed). */
  muted?: boolean;
  /** Extra content under the title (e.g. a checklist). */
  children?: ReactNode;
}) {
  const { t } = useLang();
  return (
    <li className={`flex items-start gap-3 px-5 py-3 ${muted ? "opacity-60" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        aria-label={t(done ? "markNotDoneLabel" : "markDoneLabel", { name: title })}
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${done ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-accent"}`}
      >
        {done && <Check className="size-3.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={done ? "text-muted-foreground line-through" : "font-medium"}>{title}</div>
        {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
        {children}
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        {right}
        {actions && actions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={t("moreActions", { name: title })} className="text-muted-foreground hover:text-foreground">
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map((a) => (
                <DropdownMenuItem key={a.label} onSelect={a.onSelect}>{a.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
      </div>
    </li>
  );
}

/** A small status pill: due/overdue (warning), done/skipped/postponed (quiet). */
export function Pill({ tone = "quiet", children }: { tone?: "warn" | "quiet"; children: ReactNode }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs ${tone === "warn" ? "bg-destructive/15 text-destructive" : "bg-secondary"}`}>
      {children}
    </span>
  );
}
