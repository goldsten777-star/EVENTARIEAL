"use server";

import { revalidatePath } from "next/cache";
import { getEventAccess } from "@/lib/auth/access";
import { can, ROLE_LABELS, type EventRole } from "@/lib/auth/permissions";
import { dbErrorMessage } from "@/lib/errors";
import { validationError, type FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { inviteMemberSchema } from "@/lib/validation/event";
import { Constants } from "@/types/database";

const FORBIDDEN: FormState = { ok: false, message: "רק מנהל אירוע יכול לנהל את הצוות" };

async function managerAccess(eventId: string) {
  const access = await getEventAccess(eventId);
  return can(access.role, "manage") ? access : null;
}

function isRole(value: unknown): value is EventRole {
  return (Constants.public.Enums.member_role as readonly unknown[]).includes(value);
}

export async function inviteMember(eventId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await managerAccess(eventId))) return FORBIDDEN;
  const values = { email: String(formData.get("email") ?? ""), role: String(formData.get("role") ?? "") };
  const parsed = inviteMemberSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_member", {
    p_event_id: eventId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) return { ok: false, message: dbErrorMessage(error), values };

  revalidatePath(`/events/${eventId}/settings`);
  const status = (data as { status?: string } | null)?.status;
  return {
    ok: true,
    message:
      status === "added"
        ? `${parsed.data.email} נוסף/ה לצוות בתפקיד ${ROLE_LABELS[parsed.data.role]}`
        : `ל-${parsed.data.email} עדיין אין חשבון. ברגע שיירשם/תירשם עם הכתובת הזו, הגישה תינתן אוטומטית.`,
  };
}

export async function changeMemberRole(eventId: string, userId: string, role: string): Promise<FormState> {
  const access = await managerAccess(eventId);
  if (!access) return FORBIDDEN;
  if (!isRole(role)) return { ok: false, message: "תפקיד לא תקין" };
  if (userId === access.event.owner_id) return { ok: false, message: "לא ניתן לשנות את התפקיד של בעל האירוע" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_members")
    .update({ role })
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "איש הצוות לא נמצא" };

  revalidatePath(`/events/${eventId}`, "layout");
  return { ok: true, message: `התפקיד עודכן ל${ROLE_LABELS[role]}` };
}

export async function removeMember(eventId: string, userId: string): Promise<FormState> {
  const access = await managerAccess(eventId);
  if (!access) return FORBIDDEN;
  if (userId === access.event.owner_id) return { ok: false, message: "לא ניתן להסיר את בעל האירוע" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_members")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "איש הצוות לא נמצא" };

  revalidatePath(`/events/${eventId}`, "layout");
  return { ok: true, message: "איש הצוות הוסר מהאירוע" };
}

export async function cancelInvite(eventId: string, inviteId: string): Promise<FormState> {
  if (!(await managerAccess(eventId))) return FORBIDDEN;
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_member_invites")
    .delete()
    .eq("event_id", eventId)
    .eq("id", inviteId);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath(`/events/${eventId}/settings`);
  return { ok: true, message: "ההזמנה בוטלה" };
}
