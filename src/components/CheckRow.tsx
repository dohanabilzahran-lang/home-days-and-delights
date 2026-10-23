import { Check, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

export function CheckRow({ done, onToggle, onDelete, title, meta, right }: {
  done: boolean; onToggle: () => void; onDelete: () => void; title: string; meta?: ReactNode; right?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <button
        onClick={onToggle}
        aria-pressed={done}
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${done ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-accent"}`}
      >
        {done && <Check className="size-3.5" />}
      </button>
      <div className="flex-1">
        <div className={done ? "text-muted-foreground line-through" : "font-medium"}>{title}</div>
        {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
      </div>
      {right}
      <button onClick={onDelete} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
    </li>
  );
}
