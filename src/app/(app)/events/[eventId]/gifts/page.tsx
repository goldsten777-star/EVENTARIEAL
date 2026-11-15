import type { Metadata } from "next";
import { GiftsView } from "@/components/gifts/gifts-view";
import { getGiftsPageData } from "@/features/gifts/queries";
import { requireEventSection } from "@/lib/auth/access";
import { can } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "מתנות" };

export default async function GiftsPage({ params }: PageProps<"/events/[eventId]/gifts">) {
  const { eventId } = await params;
  const access = await requireEventSection(eventId, "gifts");
  const data = await getGiftsPageData(eventId);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  return (
    <GiftsView eventId={eventId} eventName={access.event.name} data={data} canManage={can(access.role, "manage")} today={today} />
  );
}
