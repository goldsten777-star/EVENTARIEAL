import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import {
  can,
  eventHomePath,
  SECTION_CAPABILITY,
  type EventRole,
  type EventSection,
} from "@/lib/auth/permissions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Loads an event and the current user's role in it, memoized per request.
 * Unknown events and events the user cannot see both return 404, so the
 * existence of other customers' events is never revealed.
 */
export const getEventAccess = cache(async (eventId: string) => {
  if (!UUID.test(eventId)) notFound();
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: event }, { data: membership }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, event_type, event_date, host_names, venue_name, status, owner_id")
      .eq("id", eventId)
      .maybeSingle(),
    supabase
      .from("event_members")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!event) notFound();
  const role: EventRole | null = user.isPlatformAdmin ? "event_manager" : (membership?.role ?? null);
  if (!role) notFound();

  return { event, role, user, isOwner: event.owner_id === user.id };
});

export type EventAccess = Awaited<ReturnType<typeof getEventAccess>>;

/** Guards an event section; users without access are sent to their own home page. */
export async function requireEventSection(eventId: string, section: EventSection) {
  const access = await getEventAccess(eventId);
  if (!can(access.role, SECTION_CAPABILITY[section])) {
    redirect(eventHomePath(eventId, access.role));
  }
  return access;
}

/** Events visible to the current user, for the event switcher and list page. */
export const getMyEvents = cache(async () => {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: events }, { data: memberships }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, event_type, event_date, venue_name, status")
      .order("event_date", { ascending: true, nullsFirst: false }),
    supabase.from("event_members").select("event_id, role").eq("user_id", user.id),
  ]);
  const roles = new Map((memberships ?? []).map((m) => [m.event_id, m.role]));
  return (events ?? []).map((e) => ({
    ...e,
    role: (roles.get(e.id) ?? (user.isPlatformAdmin ? "event_manager" : null)) as EventRole | null,
  }));
});
