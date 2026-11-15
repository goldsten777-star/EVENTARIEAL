import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getGiftsPageData(eventId: string) {
  const supabase = await createClient();
  const [gifts, guests, expenses] = await Promise.all([
    supabase
      .from("gifts")
      .select("id, guest_id, amount, payment_method, received_at, notes, created_at, guest:guests(first_name, last_name, phone)")
      .eq("event_id", eventId)
      .order("received_at", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("guests")
      .select("id, first_name, last_name, phone, rsvp_status")
      .eq("event_id", eventId)
      .order("last_name"),
    supabase.from("expenses").select("actual_amount").eq("event_id", eventId),
  ]);
  if (gifts.error) throw gifts.error;
  return {
    gifts: gifts.data ?? [],
    guests: guests.data ?? [],
    actualExpenses: (expenses.data ?? []).reduce((s, e) => s + Number(e.actual_amount), 0),
  };
}

export type GiftsPageData = Awaited<ReturnType<typeof getGiftsPageData>>;
