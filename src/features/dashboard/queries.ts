import "server-only";
import type { EventStats } from "@/lib/dashboard/stats";
import { createClient } from "@/lib/supabase/server";

export async function getDashboardData(eventId: string) {
  const supabase = await createClient();
  const [stats, event, activity] = await Promise.all([
    supabase.rpc("event_stats", { p_event_id: eventId }),
    supabase.from("events").select("event_date, rsvp_deadline, venue_name, status").eq("id", eventId).single(),
    supabase
      .from("activity_log")
      .select("id, action, payload, created_at, guest:guests(first_name, last_name)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  if (stats.error) throw stats.error;
  return {
    // the moment the data was read; relative times ("5 minutes ago") are based on it
    fetchedAt: Date.now(),
    today: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date()),
    stats: stats.data as unknown as EventStats,
    event: event.data,
    activity: activity.data ?? [],
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
