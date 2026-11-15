import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requireEventSection } from "@/lib/auth/access";

export const metadata: Metadata = { title: "דוחות" };

export default async function Page({ params }: PageProps<"/events/[eventId]/reports">) {
  const { eventId } = await params;
  await requireEventSection(eventId, "reports");
  return <ModulePlaceholder title="דוחות" description="דוחות להדפסה וייצוא יתווספו במודול 11." />;
}
