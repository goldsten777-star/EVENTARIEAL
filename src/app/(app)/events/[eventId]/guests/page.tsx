import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requireEventSection } from "@/lib/auth/access";

export const metadata: Metadata = { title: "מוזמנים" };

export default async function Page({ params }: PageProps<"/events/[eventId]/guests">) {
  const { eventId } = await params;
  await requireEventSection(eventId, "guests");
  return <ModulePlaceholder title="מוזמנים" description="טבלת המוזמנים, הוספה ועריכה, משפחות, סינון וייבוא/ייצוא Excel יתווספו במודול 4." />;
}
