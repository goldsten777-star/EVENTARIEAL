"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getEventAccess } from "@/lib/auth/access";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { israelLocalToIso } from "@/lib/datetime";
import { dbErrorMessage } from "@/lib/errors";
import { validationError, type FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import {
  eventFormInput,
  eventSchema,
  eventSettingsSchema,
  groupSchema,
  type EventInput,
} from "@/lib/validation/event";

function toRow(d: EventInput) {
  return {
    name: d.name,
    event_type: d.eventType,
    host_names: d.hostNames,
    event_date: d.eventDate ? israelLocalToIso(d.eventDate) : null,
    venue_name: d.venueName,
    venue_address: d.venueAddress,
    rsvp_deadline: d.rsvpDeadline ? israelLocalToIso(d.rsvpDeadline) : null,
    budget_total: d.budgetTotal,
  };
}

const echo = (fd: FormData) => {
  const v = eventFormInput(fd);
  return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val]));
};

async function requireManager(eventId: string) {
  const access = await getEventAccess(eventId);
  if (!can(access.role, "manage")) return null;
  return access;
}

const FORBIDDEN: FormState = { ok: false, message: "אין לך הרשאה לבצע פעולה זו" };

export async function createEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = eventSchema.safeParse(eventFormInput(formData));
  if (!parsed.success) return validationError(parsed.error, echo(formData));

  const supabase = await createClient();
  const { data, error } = await supabase.from("events").insert(toRow(parsed.data)).select("id").single();
  if (error) return { ok: false, message: dbErrorMessage(error), values: echo(formData) };

  revalidatePath("/events");
  redirect(`/events/${data.id}/settings?created=1`);
}

export async function updateEvent(eventId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await requireManager(eventId))) return FORBIDDEN;
  const parsed = eventSettingsSchema.safeParse(eventFormInput(formData));
  if (!parsed.success) return validationError(parsed.error, echo(formData));

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({
      ...toRow(parsed.data),
      status: parsed.data.status,
      invitation_message: parsed.data.invitationMessage,
    })
    .eq("id", eventId);
  if (error) return { ok: false, message: dbErrorMessage(error), values: echo(formData) };

  revalidatePath(`/events/${eventId}`, "layout");
  revalidatePath("/events");
  return { ok: true, message: "פרטי האירוע נשמרו", values: echo(formData) };
}

export async function deleteEvent(eventId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const access = await getEventAccess(eventId);
  if (!access.isOwner && !access.user.isPlatformAdmin) {
    return { ok: false, message: "רק בעל האירוע יכול למחוק אותו" };
  }
  const typed = String(formData.get("confirmName") ?? "").trim();
  if (typed !== access.event.name.trim()) {
    return { ok: false, fieldErrors: { confirmName: ["השם שהוקלד אינו תואם לשם האירוע"] } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("events").delete().eq("id", eventId).select("id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return FORBIDDEN;

  revalidatePath("/events");
  redirect("/events?deleted=1");
}

// ---------------------------------------------------------------------------
// Guest groups
// ---------------------------------------------------------------------------

function groupError(error: { code?: string; message?: string }) {
  return error.code === "23505" ? "כבר קיימת קבוצה בשם הזה" : dbErrorMessage(error);
}

export async function saveGroup(
  eventId: string,
  groupId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await requireManager(eventId))) return FORBIDDEN;
  const values = { name: String(formData.get("name") ?? ""), color: String(formData.get("color") ?? "") };
  const parsed = groupSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  if (groupId) {
    const { error } = await supabase
      .from("guest_groups")
      .update(parsed.data)
      .eq("id", groupId)
      .eq("event_id", eventId);
    if (error) return { ok: false, message: groupError(error), values };
  } else {
    const { count } = await supabase
      .from("guest_groups")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    const { error } = await supabase
      .from("guest_groups")
      .insert({ ...parsed.data, event_id: eventId, sort_order: (count ?? 0) + 1 });
    if (error) return { ok: false, message: groupError(error), values };
  }

  revalidatePath(`/events/${eventId}`, "layout");
  return { ok: true, message: groupId ? "הקבוצה עודכנה" : "הקבוצה נוספה" };
}

export async function deleteGroup(eventId: string, groupId: string): Promise<FormState> {
  if (!(await requireManager(eventId))) return FORBIDDEN;
  const supabase = await createClient();
  const { error } = await supabase.from("guest_groups").delete().eq("id", groupId).eq("event_id", eventId);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath(`/events/${eventId}`, "layout");
  return { ok: true, message: "הקבוצה נמחקה. המוזמנים שהיו בה נשארו ללא קבוצה." };
}
