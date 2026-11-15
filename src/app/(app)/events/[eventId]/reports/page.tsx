import type { Metadata } from "next";
import Link from "next/link";
import { ArmchairIcon, ChevronLeftIcon, ClipboardListIcon, GiftIcon, PhoneCallIcon, UsersIcon, UtensilsIcon, WalletIcon, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { requireEventSection } from "@/lib/auth/access";
import { REPORTS, type ReportKey } from "@/lib/reports/build";

export const metadata: Metadata = { title: "דוחות" };

const ICONS: Record<ReportKey, LucideIcon> = {
  seating: ArmchairIcon,
  catering: UtensilsIcon,
  rsvp: PhoneCallIcon,
  attendance: ClipboardListIcon,
};

function ReportCard({ href, icon: Icon, title, description }: { href: string; icon: LucideIcon; title: string; description: string }) {
  return (
    <li>
      <Link
        href={href}
        className="group flex h-full items-start gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="flex flex-1 flex-col gap-1">
          <span className="font-semibold">{title}</span>
          <span className="text-sm text-muted-foreground">{description}</span>
        </span>
        <ChevronLeftIcon className="mt-1 size-4 text-muted-foreground transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
      </Link>
    </li>
  );
}

export default async function ReportsPage({ params }: PageProps<"/events/[eventId]/reports">) {
  const { eventId } = await params;
  await requireEventSection(eventId, "reports");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="דוחות" description="דוחות מוכנים להדפסה ולייצוא ל-Excel, מחושבים מהנתונים העדכניים." />
      <ul className="grid gap-4 md:grid-cols-2">
        {(Object.keys(REPORTS) as ReportKey[]).map((key) => (
          <ReportCard key={key} href={`/events/${eventId}/reports/${key}`} icon={ICONS[key]} title={REPORTS[key].title} description={REPORTS[key].description} />
        ))}
      </ul>
      <h2 className="text-lg font-semibold">ייצוא מהמסכים עצמם</h2>
      <ul className="grid gap-4 md:grid-cols-3">
        <ReportCard href={`/events/${eventId}/guests`} icon={UsersIcon} title="רשימת מוזמנים מלאה" description="כפתור 'ייצוא' בעמוד המוזמנים, לפי הסינון הנוכחי." />
        <ReportCard href={`/events/${eventId}/gifts`} icon={GiftIcon} title="מתנות" description="כפתור 'ייצוא' בעמוד המתנות, כולל שורת סיכום." />
        <ReportCard href={`/events/${eventId}/budget`} icon={WalletIcon} title="תקציב והוצאות" description="כפתור 'ייצוא' בעמוד התקציב, כולל יתרות לתשלום." />
      </ul>
    </div>
  );
}
