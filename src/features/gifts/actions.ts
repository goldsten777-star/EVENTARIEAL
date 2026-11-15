"use server";

import { revalidatePath } from "next/cache";
import { getEventAccess } from "@/lib/auth/access";
import { can } from "@/lib/auth/permissions";
import { dbErrorMessage } from "@/lib/errors";
import { formValues, validationError, type FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { giftFormInput, giftSchema } from "@/lib/validation/gift";

const FORBIDDEN: FormState = { ok: false, message: "אין לך הרשאה לערוך מתנות באירוע זה" };
const FIELDS = ["guestId", "amount", "paymentMethod", "receivedAt", "notes"];

async function canManage(eventId: string) {
  const access = await getEventAccess(eventId);
  return can(access.role, "manage");
}

export async function saveGift(eventId: string, giftId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await canManage(eventId))) return FORBIDDEN;
  const values = formValues(formData, FIELDS);
  const parsed = giftSchema.safeParse(giftFormInput(formData));
  if (!parsed.success) return validationError(parsed.error, values);
  const d = parsed.data;

  const row = {
    guest_id: d.guestId,
    amount: d.amount ?? 0,
    payment_method: d.paymentMethod,
    received_at: d.receivedAt!,
    notes: d.notes,
  };
  const supabase = await createClient();
  const { error } = giftId
    ? await supabase.from("gifts").update(row).eq("id", giftId).eq("event_id", eventId)
    : await supabase.from("gifts").insert({ ...row, event_id: eventId });
  if (error) return { ok: false, message: dbErrorMessage(error), values };

  revalidatePath(`/events/${eventId}`, "layout");
  return { ok: true, message: giftId ? "המתנה עודכנה" : "המתנה נרשמה" };
}

export async function deleteGift(eventId: string, giftId: string): Promise<FormState> {
  if (!(await canManage(eventId))) return FORBIDDEN;
  const supabase = await createClient();
  const { data, error } = await supabase.from("gifts").delete().eq("id", giftId).eq("event_id", eventId).select("id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "המתנה לא נמצאה" };
  revalidatePath(`/events/${eventId}`, "layout");
  return { ok: true, message: "המתנה נמחקה" };
}
