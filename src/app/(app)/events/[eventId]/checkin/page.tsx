import type { Metadata } from "next";
import { CheckinView } from "@/components/checkin/checkin-view";
import { requireEventSection } from "@/lib/auth/access";
import { can } from "@/lib/auth/permissions";
import { parseCheckinStats } from "@/lib/checkin/token";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Check-in" };

export default async function Page({ params }: PageProps<"/events/[eventId]/checkin">) {
  const { eventId } = await params;
  const access = await requireEventSection(eventId, "checkin");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("checkin_stats", { p_event_id: eventId });
  if (error) throw new Error(error.message);

  return (
    <CheckinView
      eventId={eventId}
      eventName={access.event.name}
      canUndo={can(access.role, "manage")}
      initialStats={parseCheckinStats(data)}
    />
  );
}
