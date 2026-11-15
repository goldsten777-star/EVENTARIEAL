import { cn } from "@/lib/utils";

/** A headline number with a short label and an optional context line. */
export function StatTile({
  label,
  value,
  context,
  badge,
  children,
  className,
}: {
  label: string;
  value: React.ReactNode;
  context?: React.ReactNode;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-col gap-2 rounded-2xl border bg-card p-5", className)}>
      <span className="text-sm text-muted-foreground" aria-hidden="true">
        {label}
      </span>
      <div className="flex flex-wrap items-baseline gap-2.5">
        <span data-slot="stat-value" className="text-3xl font-bold tracking-tight tabular-nums">
          {value}
        </span>
        {badge}
      </div>
      {children}
      {context ? <span className="text-sm text-muted-foreground">{context}</span> : null}
    </div>
  );
}

/** Neutral pill for a percentage next to a headline number (text stays in text color). */
export function PercentBadge({ value }: { value: number }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
      {value}%
    </span>
  );
}

/** Thin single-series meter: filled share on a neutral track. */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-2 overflow-hidden rounded-full bg-track"
    >
      <div className="h-full rounded-full bg-viz-1" style={{ width: `${pct}%` }} />
    </div>
  );
}
