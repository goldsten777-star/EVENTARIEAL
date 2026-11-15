"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { TimelinePoint } from "@/lib/dashboard/stats";

const config = {
  attending: { label: "אישרו (הזמנות)", theme: { light: "#2a78d6", dark: "#3987e5" } },
  declined: { label: "סירבו (הזמנות)", theme: { light: "#eb6834", dark: "#d95926" } },
} satisfies ChartConfig;

const dayLabel = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}`;
};

/** Cumulative answers over time: two series, one axis, legend + crosshair tooltip + table view. */
export function ResponsesChart({ data }: { data: TimelinePoint[] }) {
  if (data.length < 2) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        הגרף יוצג אחרי שיתקבלו תשובות בכמה ימים שונים.
      </p>
    );
  }
  const last = data[data.length - 1];
  return (
    <div className="flex flex-col gap-2">
      {/* time runs left-to-right like numbers; the chart is laid out LTR inside the RTL page */}
      <div dir="ltr">
        <ChartContainer config={config} className="aspect-auto h-56 w-full">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} strokeWidth={1} />
            <XAxis dataKey="day" tickFormatter={dayLabel} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
            <ChartTooltip
              cursor={{ strokeWidth: 1 }}
              content={<ChartTooltipContent labelFormatter={(v) => dayLabel(String(v))} indicator="line" />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line dataKey="attending" type="monotone" stroke="var(--color-attending)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2 }} />
            <Line dataKey="declined" type="monotone" stroke="var(--color-declined)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2 }} />
          </LineChart>
        </ChartContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        עד היום: {last.attending} הזמנות אישרו, {last.declined} סירבו.
      </p>
      <table className="sr-only">
        <caption>תשובות מצטברות לפי יום</caption>
        <thead>
          <tr>
            <th>תאריך</th>
            <th>אישרו</th>
            <th>סירבו</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.day}>
              <td>{dayLabel(p.day)}</td>
              <td>{p.attending}</td>
              <td>{p.declined}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
