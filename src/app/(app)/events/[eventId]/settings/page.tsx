import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requireEventSection } from "@/lib/auth/access";

export const metadata: Metadata = { title: "הגדרות וצוות" };

export default async function Page({ params }: PageProps<"/events/[eventId]/settings">) {
  const { eventId } = await params;
  await requireEventSection(eventId, "settings");
  return <ModulePlaceholder title="הגדרות וצוות" description="עריכת פרטי האירוע וניהול הצוות וההרשאות יתווספו במודול 3." />;
}
