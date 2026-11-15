import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requireEventSection } from "@/lib/auth/access";

export const metadata: Metadata = { title: "סידורי ישיבה" };

export default async function Page({ params }: PageProps<"/events/[eventId]/seating">) {
  const { eventId } = await params;
  await requireEventSection(eventId, "seating");
  return <ModulePlaceholder title="סידורי ישיבה" description="מפת השולחנות וגרירת אורחים יתווספו במודול 7." />;
}
