import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getTeam(eventId: string) {
  const supabase = await createClient();
  const [members, invites] = await Promise.all([
    supabase
      .from("event_members")
      .select("user_id, role, created_at, profile:profiles!event_members_user_id_fkey(full_name, email)")
      .eq("event_id", eventId)
      .order("created_at"),
    supabase
      .from("event_member_invites")
      .select("id, email, role, created_at")
      .eq("event_id", eventId)
      .is("accepted_at", null)
      .order("created_at"),
  ]);
  if (members.error) throw members.error;
  return { members: members.data ?? [], invites: invites.data ?? [] };
}

export async function getGroups(eventId: string) {
  const supabase = await createClient();
  const [{ data: groups, error }, { data: guests }] = await Promise.all([
    supabase.from("guest_groups").select("id, name, color, sort_order").eq("event_id", eventId).order("sort_order"),
    supabase.from("guests").select("group_id").eq("event_id", eventId).not("group_id", "is", null),
  ]);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const g of guests ?? []) counts.set(g.group_id!, (counts.get(g.group_id!) ?? 0) + 1);
  return (groups ?? []).map((g) => ({ ...g, guestCount: counts.get(g.id) ?? 0 }));
}
