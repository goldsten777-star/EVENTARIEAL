import "server-only";
import { createClient } from "@/lib/supabase/server";

export const GUEST_COLUMNS =
  "id, first_name, last_name, phone, email, group_id, inviter_name, invited_adults, invited_children, reserved_seats, invitation_status, rsvp_status, confirmed_adults, confirmed_children, rsvp_note, table_id, dietary_tags, dietary_notes, notes, seats_needed, checked_in_at, created_at";

export async function getGuestsPageData(eventId: string) {
  const supabase = await createClient();
  const [guests, groups, tables] = await Promise.all([
    supabase.from("guests").select(GUEST_COLUMNS).eq("event_id", eventId).order("created_at", { ascending: false }),
    supabase.from("guest_groups").select("id, name, color").eq("event_id", eventId).order("sort_order"),
    supabase.from("seating_tables").select("id, number, name, capacity").eq("event_id", eventId).order("number"),
  ]);
  if (guests.error) throw guests.error;

  const used = new Map<string, number>();
  for (const g of guests.data) if (g.table_id) used.set(g.table_id, (used.get(g.table_id) ?? 0) + (g.seats_needed ?? 0));

  return {
    guests: guests.data,
    groups: groups.data ?? [],
    tables: (tables.data ?? []).map((t) => ({ ...t, used: used.get(t.id) ?? 0 })),
  };
}

export type GuestsPageData = Awaited<ReturnType<typeof getGuestsPageData>>;
export type GuestRow = GuestsPageData["guests"][number];
