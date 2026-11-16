"use server";

import { revalidatePath } from "next/cache";
import { getEventAccess } from "@/lib/auth/access";
import { can } from "@/lib/auth/permissions";
import { parseCheckinStats, parseScannedToken, type CheckinStats } from "@/lib/checkin/token";
import { dbErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type DoorRow = Database["public"]["Functions"]["checkin_search"]["Returns"][number];
/** Door-only guest fields; the generated types miss that these columns can be null. */
export type DoorGuest = Omit<DoorRow, "checked_in_at" | "arrived_count" | "table_number" | "table_name" | "group_name" | "phone"> & {
  checked_in_at: string | null;
  arrived_count: number | null;
  table_number: number | null;
  table_name: string | null;
  group_name: string | null;
  phone: string | null;
};
type Result<T> = { ok: true; data: T } | { ok: false; message: string };

const FORBIDDEN = { ok: false, message: "אין לך הרשאה לבצע Check-in באירוע זה" } as const;

async function door(eventId: string) {
  const access = await getEventAccess(eventId);
  return can(access.role, "checkin") ? access : null;
}

export async function searchDoorGuests(eventId: string, query: string): Promise<Result<DoorGuest[]>> {
  if (!(await door(eventId))) return FORBIDDEN;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("checkin_search", { p_event_id: eventId, p_query: query.slice(0, 100) });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  return { ok: true, data: data ?? [] };
}

export async function getDoorGuest(eventId: string, guestId: string): Promise<Result<DoorGuest>> {
  if (!(await door(eventId))) return FORBIDDEN;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("checkin_get_guest", { p_event_id: eventId, p_guest_id: guestId });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "האורח לא נמצא באירוע זה" };
  return { ok: true, data: data[0] };
}

/** Looks up the guest behind a scanned QR code or a pasted invitation link. */
export async function findDoorGuestByCode(eventId: string, scanned: string): Promise<Result<DoorGuest>> {
  if (!(await door(eventId))) return FORBIDDEN;
  const token = parseScannedToken(scanned);
  if (!token) return { ok: false, message: "הקוד אינו קישור הזמנה של המערכת" };
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("checkin_find_by_token", { p_event_id: eventId, p_token: token });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!id) return { ok: false, message: "לא נמצא אורח עם הקוד הזה באירוע" };
  return getDoorGuest(eventId, id);
}

export async function getDoorStats(eventId: string): Promise<Result<CheckinStats>> {
  if (!(await door(eventId))) return FORBIDDEN;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("checkin_stats", { p_event_id: eventId });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  return { ok: true, data: parseCheckinStats(data) };
}

export type CheckInOutcome = { status: "checked_in" | "already_checked_in"; checkedInAt: string; arrivedCount: number };

export async function checkInDoorGuest(eventId: string, guestId: string, arrived: number): Promise<Result<CheckInOutcome>> {
  if (!(await door(eventId))) return FORBIDDEN;
  if (!Number.isInteger(arrived) || arrived < 1 || arrived > 100) {
    return { ok: false, message: "מספר המגיעים חייב להיות בין 1 ל-100" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_in_guest", {
    p_event_id: eventId,
    p_guest_id: guestId,
    p_arrived_count: arrived,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  const r = data as { status: CheckInOutcome["status"]; checked_in_at: string; arrived_count: number };
  if (r.status === "checked_in") revalidatePath(`/events/${eventId}`, "layout");
  return { ok: true, data: { status: r.status, checkedInAt: r.checked_in_at, arrivedCount: r.arrived_count } };
}

export async function undoDoorCheckIn(eventId: string, guestId: string): Promise<Result<null>> {
  const access = await getEventAccess(eventId);
  if (!can(access.role, "manage")) return { ok: false, message: "רק מנהל אירוע יכול לבטל כניסה" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_check_in", { p_event_id: eventId, p_guest_id: guestId });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath(`/events/${eventId}`, "layout");
  return { ok: true, data: null };
}
