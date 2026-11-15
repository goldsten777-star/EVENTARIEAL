import "server-only";
import type { ReportGuest, ReportTable } from "@/lib/reports/build";
import { createClient } from "@/lib/supabase/server";

export async function getReportRows(eventId: string): Promise<{ guests: ReportGuest[]; tables: ReportTable[] }> {
  const supabase = await createClient();
  const [guests, tables] = await Promise.all([
    supabase
      .from("guests")
      .select(
        "id, first_name, last_name, phone, inviter_name, rsvp_status, invitation_status, invited_adults, invited_children, reserved_seats, confirmed_adults, confirmed_children, seats_needed, dietary_tags, dietary_notes, rsvp_note, table_id, checked_in_at, arrived_count, group:guest_groups(name)",
      )
      .eq("event_id", eventId),
    supabase.from("seating_tables").select("id, number, name, capacity").eq("event_id", eventId),
  ]);
  if (guests.error) throw guests.error;
  return {
    guests: (guests.data ?? []).map(({ group, ...g }) => ({ ...g, group_name: (group as { name: string } | null)?.name ?? null })),
    tables: tables.data ?? [],
  };
}
