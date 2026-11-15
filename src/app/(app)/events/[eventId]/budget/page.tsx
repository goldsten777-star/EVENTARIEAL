import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requireEventSection } from "@/lib/auth/access";

export const metadata: Metadata = { title: "תקציב" };

export default async function Page({ params }: PageProps<"/events/[eventId]/budget">) {
  const { eventId } = await params;
  await requireEventSection(eventId, "budget");
  return <ModulePlaceholder title="תקציב" description="הוצאות לפי קטגוריה ותקציב מתוכנן מול בפועל יתווספו במודול 9." />;
}
