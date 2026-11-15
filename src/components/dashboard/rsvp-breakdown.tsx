"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { percent } from "@/lib/dashboard/stats";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Part = { key: string; label: string; value: number; swatch: string };

/**
 * Part-to-whole of invited people as one stacked bar: attending (series 1),
 * declined (series 2) and the still-unanswered remainder as the neutral track.
 * Identity never relies on color alone: every part has a labelled legend row.
 */
export function RsvpBreakdown({
  attending,
  declined,
  pending,
}: {
  attending: number;
  declined: number;
  pending: number;
}) {
  const total = attending + declined + pending;
  const parts: Part[] = [
    { key: "attending", label: "אישרו הגעה", value: attending, swatch: "bg-viz-1" },
    { key: "declined", label: "לא מגיעים", value: declined, swatch: "bg-viz-2" },
    { key: "pending", label: "טרם ענו", value: pending, swatch: "bg-track" },
  ];

  if (!total) {
    return <p className="py-6 text-center text-sm text-muted-foreground">עוד אין מוזמנים באירוע.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="text-4xl font-bold tracking-tight tabular-nums">{percent(attending, total)}%</span>
        <span className="text-sm text-muted-foreground">מהמוזמנים אישרו הגעה</span>
      </div>

      {/* 2px surface gaps separate the segments; no strokes */}
      <div className="flex h-6 w-full gap-0.5" role="img" aria-label={parts.map((p) => `${p.label}: ${p.value}`).join(", ")}>
        {parts
          .filter((p) => p.value > 0)
          .map((p, i, shown) => (
            <Tooltip key={p.key}>
              <TooltipTrigger asChild>
                <div
                  tabIndex={0}
                  aria-label={`${p.label}: ${formatNumber(p.value)} (${percent(p.value, total)}%)`}
                  className={cn(
                    "h-full min-w-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    p.swatch,
                    i === 0 && "rounded-s-md",
                    i === shown.length - 1 && "rounded-e-md",
                  )}
                  style={{ flexGrow: p.value, flexBasis: 0 }}
                />
              </TooltipTrigger>
              <TooltipContent>
                {p.label}: {formatNumber(p.value)} ({percent(p.value, total)}%)
              </TooltipContent>
            </Tooltip>
          ))}
      </div>

      <ul className="flex flex-col gap-2.5 text-sm">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2.5">
            <span className={cn("size-3 shrink-0 rounded-[3px]", p.swatch)} aria-hidden="true" />
            <span className="flex-1">{p.label}</span>
            <span className="font-semibold tabular-nums">{formatNumber(p.value)}</span>
            <span className="w-11 text-end text-muted-foreground tabular-nums">{percent(p.value, total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
