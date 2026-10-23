import type { ReactNode } from "react";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string | undefined; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-4xl text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">{text}</p>;
}

/**
 * Shows loading and load-error states before a list, so "Nothing here yet"
 * only appears when the list really is empty.
 */
export function ListState({ query, isEmpty, children }: {
  query: { isPending: boolean; isError: boolean; refetch: () => unknown };
  isEmpty: boolean;
  children: ReactNode;
}) {
  const { t } = useLang();
  if (query.isPending) {
    return <p role="status" className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">{t("loading")}</p>;
  }
  if (query.isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-destructive/40 p-8 text-center">
        <p className="text-destructive">{t("loadFailed")}</p>
        <Button variant="outline" className="rounded-full" onClick={() => query.refetch()}>{t("retry")}</Button>
      </div>
    );
  }
  if (isEmpty) return <Empty text={t("empty")} />;
  return <>{children}</>;
}
