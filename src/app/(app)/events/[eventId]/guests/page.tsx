import type { Metadata } from "next";
import { GuestsView } from "@/components/guests/guests-view";
import { getGuestsPageData } from "@/features/guests/queries";
import { requireEventSection } from "@/lib/auth/access";
import { can } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "מוזמנים" };

export default async function GuestsPage({ params }: PageProps<"/events/[eventId]/guests">) {
  const { eventId } = await params;
  const access = await requireEventSection(eventId, "guests");
  const data = await getGuestsPageData(eventId);

  return (
    <GuestsView
      eventId={eventId}
      eventName={access.event.name}
      guests={data.guests}
      groups={data.groups}
      tables={data.tables}
      canManage={can(access.role, "manage")}
    />
  );
}
