import type { Metadata } from "next";
import { GuestsView } from "@/components/guests/guests-view";
import { getGuestsPageData } from "@/features/guests/queries";
import { requireEventSection } from "@/lib/auth/access";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "מוזמנים" };

export default async function GuestsPage({ params }: PageProps<"/events/[eventId]/guests">) {
  const { eventId } = await params;
  const access = await requireEventSection(eventId, "guests");
  const supabase = await createClient();
  const [data, { data: event }] = await Promise.all([
    getGuestsPageData(eventId),
    supabase.from("events").select("invitation_message").eq("id", eventId).single(),
  ]);

  return (
    <GuestsView
      eventId={eventId}
      eventName={access.event.name}
      invitationTemplate={event?.invitation_message ?? null}
      guests={data.guests}
      groups={data.groups}
      tables={data.tables}
      canManage={can(access.role, "manage")}
    />
  );
}
