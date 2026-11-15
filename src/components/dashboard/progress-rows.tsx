import { formatNumber } from "@/lib/format";

export type ProgressRow = { key: string; label: string; value: number; total: number; caption: string; marker?: string };

/**
 * One series per row (value on a track of its total). Single series, so no
 * legend box: the card title names what is plotted; each row carries its
 * own label and figures as text.
 */
export function ProgressRows({ rows, empty }: { rows: ProgressRow[]; empty: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col gap-4">
      {rows.map((r) => {
        const pct = r.total > 0 ? Math.min(100, (r.value / r.total) * 100) : 0;
        return (
          <li key={r.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 font-medium">
                {r.marker ? (
                  <span className="size-2.5 rounded-full" style={{ background: r.marker }} aria-hidden="true" />
                ) : null}
                {r.label}
              </span>
              <span className="text-muted-foreground tabular-nums">{r.caption}</span>
            </div>
            <div
              role="meter"
              aria-label={`${r.label}: ${formatNumber(r.value)} מתוך ${formatNumber(r.total)}`}
              aria-valuemin={0}
              aria-valuemax={r.total}
              aria-valuenow={r.value}
              className="h-2.5 overflow-hidden rounded-full bg-track"
            >
              <div className="h-full rounded-full bg-viz-1" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
