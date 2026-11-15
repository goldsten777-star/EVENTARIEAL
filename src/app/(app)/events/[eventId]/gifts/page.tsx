import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requireEventSection } from "@/lib/auth/access";

export const metadata: Metadata = { title: "מתנות" };

export default async function Page({ params }: PageProps<"/events/[eventId]/gifts">) {
  const { eventId } = await params;
  await requireEventSection(eventId, "gifts");
  return <ModulePlaceholder title="מתנות" description="תיעוד מתנות וסיכום הכנסות יתווספו במודול 8." />;
}
