import { useLang, type Key } from "@/lib/i18n";
import type { Completion } from "@/lib/recurrence";

const WEEKDAYS: { iso: number; key: Key }[] = [
  { iso: 6, key: "wd_sat" },
  { iso: 7, key: "wd_sun" },
  { iso: 1, key: "wd_mon" },
  { iso: 2, key: "wd_tue" },
  { iso: 3, key: "wd_wed" },
  { iso: 4, key: "wd_thu" },
  { iso: 5, key: "wd_fri" },
];

/** Choose which weekdays an item happens on. None selected = every day. Week starts Saturday (Egypt). */
export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const { t } = useLang();
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("days")}>
        {WEEKDAYS.map((d) => {
          const on = value.includes(d.iso);
          return (
            <button key={d.iso} type="button" aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== d.iso) : [...value, d.iso].sort())}
              className={`rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
              {t(d.key)}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{value.length === 0 ? t("everyDay") : t("onlyChosenDays")}</p>
    </div>
  );
}

/** Short label for a weekday schedule, e.g. "Sat · Mon · Wed", or nothing for every day. */
export function useScheduleLabel() {
  const { t } = useLang();
  return (days: number[] | null) =>
    !days || days.length === 0 ? "" : WEEKDAYS.filter((d) => days.includes(d.iso)).map((d) => t(d.key)).join(" · ");
}

/** The last entries of an item's history: done or skipped, newest first. */
export function HistoryList({ history, sourceId }: { history: Completion[]; sourceId: string }) {
  const { t } = useLang();
  const mine = history.filter((c) => c.source_id === sourceId).slice(0, 10);
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium">{t("history")}</div>
      {mine.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("noHistory")}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {mine.map((c) => (
            <li key={c.on_date} className="flex justify-between gap-3 tabular-nums">
              <span>{c.on_date}</span>
              <span className="text-muted-foreground">{c.status === "skipped" ? t("skipped") : t("doneWord")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
