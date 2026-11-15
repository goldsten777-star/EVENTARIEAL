import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/reports/report-view";
import { getReportRows } from "@/features/reports/queries";
import { requireEventSection } from "@/lib/auth/access";
import { buildReport, isReportKey, REPORTS } from "@/lib/reports/build";

export async function generateMetadata({ params }: PageProps<"/events/[eventId]/reports/[report]">): Promise<Metadata> {
  const { report } = await params;
  return { title: isReportKey(report) ? REPORTS[report].title : "דוח" };
}

export default async function ReportPage({ params }: PageProps<"/events/[eventId]/reports/[report]">) {
  const { eventId, report } = await params;
  if (!isReportKey(report)) notFound();
  const access = await requireEventSection(eventId, "reports");
  const { guests, tables } = await getReportRows(eventId);
  const generatedAt = new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

  return (
    <ReportView
      eventId={eventId}
      eventName={access.event.name}
      title={REPORTS[report].title}
      description={REPORTS[report].description}
      generatedAt={generatedAt}
      report={buildReport(report, guests, tables)}
    />
  );
}
