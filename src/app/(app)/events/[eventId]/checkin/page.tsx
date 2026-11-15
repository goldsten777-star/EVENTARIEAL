import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requireEventSection } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Check-in" };

export default async function Page({ params }: PageProps<"/events/[eventId]/checkin">) {
  const { eventId } = await params;
  await requireEventSection(eventId, "checkin");
  return <ModulePlaceholder title="Check-in" description="מסך הכניסה עם חיפוש, סריקת QR ומונה הגעות יתווסף במודול 10." />;
}
