import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requireEventSection } from "@/lib/auth/access";

export const metadata: Metadata = { title: "לוח בקרה" };

export default async function Page({ params }: PageProps<"/events/[eventId]/dashboard">) {
  const { eventId } = await params;
  await requireEventSection(eventId, "dashboard");
  return <ModulePlaceholder title="לוח בקרה" description="סיכום אישורי ההגעה, השולחנות והתקציב עם גרפים בזמן אמת יתווסף במודול 6." />;
}
