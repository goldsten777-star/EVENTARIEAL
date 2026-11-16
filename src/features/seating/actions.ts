"use server";

import { revalidatePath } from "next/cache";
import { getEventAccess } from "@/lib/auth/access";
import { can } from "@/lib/auth/permissions";
import { dbErrorMessage } from "@/lib/errors";
import { formValues, validationError, type FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { tableFormInput, tableSchema } from "@/lib/validation/table";

const FORBIDDEN: FormState = { ok: false, message: "אין לך הרשאה לערוך את סידורי הישיבה באירוע זה" };
const FIELDS = ["number", "count", "name", "capacity", "shape"];

async function canManage(eventId: string) {
  const access = await getEventAccess(eventId);
  return can(access.role, "manage");
}

export async function saveTable(eventId: string, tableId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await canManage(eventId))) return FORBIDDEN;
  const values = formValues(formData, FIELDS);
  const parsed = tableSchema.safeParse(tableFormInput(formData));
  if (!parsed.success) return validationError(parsed.error, values);
  const d = parsed.data;

  const supabase = await createClient();
  const row = { name: d.name, capacity: d.capacity, shape: d.shape };
  const count = tableId ? 1 : d.count;
  const { error } = tableId
    ? await supabase.from("seating_tables").update({ ...row, number: d.number }).eq("id", tableId).eq("event_id", eventId)
    : await supabase.from("seating_tables").insert(
        Array.from({ length: count }, (_, i) => ({
          ...row,
          event_id: eventId,
          number: d.number + i,
          name: count === 1 ? d.name : null,
        })),
      );
  if (error) {
    if (error.code === "23505") {
      const message = count > 1 ? "אחד ממספרי השולחנות כבר קיים" : `כבר קיים שולחן מספר ${d.number}`;
      return { ok: false, message, fieldErrors: { number: [message] }, values };
    }
    if (error.code === "P0001") return { ok: false, message: error.message, fieldErrors: { capacity: [error.message] }, values };
    return { ok: false, message: dbErrorMessage(error), values };
  }

  revalidatePath(`/events/${eventId}`, "layout");
  return {
    ok: true,
    message: tableId ? "השולחן עודכן" : count > 1 ? `נוספו ${count} שולחנות` : `שולחן ${d.number} נוסף`,
  };
}

export async function deleteTable(eventId: string, tableId: string): Promise<FormState> {
  if (!(await canManage(eventId))) return FORBIDDEN;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seating_tables")
    .delete()
    .eq("id", tableId)
    .eq("event_id", eventId)
    .select("number");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "השולחן לא נמצא" };
  revalidatePath(`/events/${eventId}`, "layout");
  return { ok: true, message: `שולחן ${data[0].number} נמחק` };
}

/** Seats a guest at a table (or unseats with null); the database enforces capacity. */
export async function assignGuestTable(eventId: string, guestId: string, tableId: string | null): Promise<FormState> {
  if (!(await canManage(eventId))) return FORBIDDEN;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guests")
    .update({ table_id: tableId })
    .eq("id", guestId)
    .eq("event_id", eventId)
    .select("id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "האורח לא נמצא" };
  revalidatePath(`/events/${eventId}`, "layout");
  return { ok: true };
}
