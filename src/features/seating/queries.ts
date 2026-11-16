import "server-only";
import type { SeatingGuest, SeatingTable } from "@/lib/seating/plan";
import { createClient } from "@/lib/supabase/server";

export type SeatingGroup = { id: string; name: string; color: string };

export async function getSeatingData(eventId: string) {
  const supabase = await createClient();
  const [tables, guests, groups] = await Promise.all([
    supabase.from("seating_tables").select("id, number, name, capacity, shape").eq("event_id", eventId).order("number"),
    supabase
      .from("guests")
      .select("id, first_name, last_name, group_id, rsvp_status, seats_needed, table_id")
      .eq("event_id", eventId)
      // declined guests only matter while they still hold a seat
      .or("rsvp_status.neq.declined,table_id.not.is.null")
      .order("last_name"),
    supabase.from("guest_groups").select("id, name, color").eq("event_id", eventId).order("sort_order"),
  ]);
  const error = tables.error ?? guests.error ?? groups.error;
  if (error) throw new Error(error.message);
  return {
    tables: (tables.data ?? []) as SeatingTable[],
    guests: (guests.data ?? []).map((g) => ({ ...g, seats_needed: g.seats_needed ?? 0 })) as SeatingGuest[],
    groups: (groups.data ?? []) as SeatingGroup[],
  };
}
