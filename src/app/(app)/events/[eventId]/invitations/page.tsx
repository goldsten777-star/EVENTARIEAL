import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requireEventSection } from "@/lib/auth/access";

export const metadata: Metadata = { title: "הזמנות ואישורים" };

export default async function Page({ params }: PageProps<"/events/[eventId]/invitations">) {
  const { eventId } = await params;
  await requireEventSection(eventId, "invitations");
  return <ModulePlaceholder title="הזמנות ואישורים" description="שליחת קישורים אישיים ב-WhatsApp ומעקב אחר אישורי הגעה יתווספו במודול 5." />;
}
