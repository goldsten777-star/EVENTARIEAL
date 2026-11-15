"use client";

import Link from "next/link";
import { ArrowRightIcon, DownloadIcon, PrinterIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportWorkbook } from "@/lib/excel/export";
import type { Report } from "@/lib/reports/build";
import { cn } from "@/lib/utils";

export function ReportView({
  eventId,
  eventName,
  title,
  description,
  generatedAt,
  report,
}: {
  eventId: string;
  eventName: string;
  title: string;
  description: string;
  generatedAt: string;
  report: Report;
}) {
  async function exportExcel() {
    try {
      await exportWorkbook(`${eventName} - ${title}`, [
        {
          name: "סיכום",
          columns: [{ header: "נתון", width: 28 }, { header: "ערך", width: 12 }],
          rows: report.summary.map((s) => [s.label, s.value]),
        },
        ...report.sections.map((s) => ({
          name: s.title,
          columns: s.columns.map((c) => ({ header: c.label, width: c.numeric ? 10 : 20 })),
          rows: s.rows.map((r) => s.columns.map((c) => r[c.key] ?? "")),
        })),
      ]);
      toast.success("הדוח יוצא ל-Excel");
    } catch {
      toast.error("הייצוא נכשל. נסו שוב.");
    }
  }

  return (
    <article className="flex flex-col gap-6">
      <div data-print="hide" className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost">
          <Link href={`/events/${eventId}/reports`}>
            <ArrowRightIcon aria-hidden="true" /> כל הדוחות
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" onClick={() => window.print()}>
            <PrinterIcon aria-hidden="true" /> הדפסה
          </Button>
          <Button size="lg" onClick={() => void exportExcel()}>
            <DownloadIcon aria-hidden="true" /> ייצוא ל-Excel
          </Button>
        </div>
      </div>

      <header className="flex flex-col gap-1.5">
        <p className="text-sm text-muted-foreground">{eventName}</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {description} · הופק {generatedAt}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {report.summary.map((s) => (
          <div key={s.label} className="flex flex-col gap-1 rounded-2xl border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="text-2xl font-bold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      {report.sections.map((section, i) => (
        <section key={section.title} data-print="section" aria-labelledby={`report-sec-${i}`} className="flex flex-col gap-2">
          <h2 id={`report-sec-${i}`} className="text-lg font-semibold">
            {section.title} <span className="text-sm font-normal text-muted-foreground">({section.rows.length})</span>
          </h2>
          {section.rows.length ? (
            <div className="relative overflow-x-auto rounded-2xl border bg-card print:overflow-visible">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    {section.columns.map((c) => (
                      <th key={c.key} scope="col" className="h-10 px-3 text-start font-medium whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {section.columns.map((c) => (
                        <td key={c.key} className={cn("px-3 py-2", c.numeric && "tabular-nums", c.key === "phone" && "whitespace-nowrap")} dir={c.key === "phone" ? "ltr" : undefined}>
                          {r[c.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{section.empty}</p>
          )}
        </section>
      ))}
    </article>
  );
}
