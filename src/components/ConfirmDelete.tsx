import type { ReactNode } from "react";
import { useLang } from "@/lib/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** Wraps a delete control so nothing is removed without a confirmation step. */
export function ConfirmDelete({ name, onConfirm, children }: { name: string; onConfirm: () => void; children: ReactNode }) {
  const { t } = useLang();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteTitle", { name })}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
