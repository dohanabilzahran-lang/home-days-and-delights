import type { FormEvent, ReactNode } from "react";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** A controlled dialog holding a small form with one Save button. Used for every add/edit screen. */
export function FormDialog({ open, onOpenChange, title, onSubmit, children, submitLabel }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onSubmit: () => void;
  children: ReactNode;
  submitLabel?: string | undefined;
}) {
  const { t } = useLang();
  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {children}
          <Button type="submit" className="w-full rounded-full">{submitLabel ?? t("save")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A labelled form field: the label sits above the control and is tied to it for screen readers. */
export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
