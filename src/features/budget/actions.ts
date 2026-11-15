"use server";

import { revalidatePath } from "next/cache";
import { getEventAccess } from "@/lib/auth/access";
import { can } from "@/lib/auth/permissions";
import { dbErrorMessage } from "@/lib/errors";
import { formValues, validationError, type FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { expenseFormInput, expenseSchema } from "@/lib/validation/expense";
import { amount } from "@/lib/validation/money";

const FORBIDDEN: FormState = { ok: false, message: "אין לך הרשאה לערוך את התקציב באירוע זה" };
const FIELDS = ["category", "vendorName", "description", "plannedAmount", "actualAmount", "paidAmount", "dueDate", "notes"];

async function canManage(eventId: string) {
  const access = await getEventAccess(eventId);
  return can(access.role, "manage");
}

export async function saveExpense(eventId: string, expenseId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await canManage(eventId))) return FORBIDDEN;
  const values = formValues(formData, FIELDS);
  const parsed = expenseSchema.safeParse(expenseFormInput(formData));
  if (!parsed.success) return validationError(parsed.error, values);
  const d = parsed.data;
  const row = {
    category: d.category,
    vendor_name: d.vendorName,
    description: d.description,
    planned_amount: d.plannedAmount ?? 0,
    actual_amount: d.actualAmount ?? 0,
    paid_amount: d.paidAmount ?? 0,
    due_date: d.dueDate,
    notes: d.notes,
  };
  const supabase = await createClient();
  const { error } = expenseId
    ? await supabase.from("expenses").update(row).eq("id", expenseId).eq("event_id", eventId)
    : await supabase.from("expenses").insert({ ...row, event_id: eventId });
  if (error) return { ok: false, message: dbErrorMessage(error), values };
  revalidatePath(`/events/${eventId}`, "layout");
  return { ok: true, message: expenseId ? "ההוצאה עודכנה" : "ההוצאה נוספה" };
}

export async function deleteExpense(eventId: string, expenseId: string): Promise<FormState> {
  if (!(await canManage(eventId))) return FORBIDDEN;
  const supabase = await createClient();
  const { data, error } = await supabase.from("expenses").delete().eq("id", expenseId).eq("event_id", eventId).select("id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "ההוצאה לא נמצאה" };
  revalidatePath(`/events/${eventId}`, "layout");
  return { ok: true, message: "ההוצאה נמחקה" };
}

const budgetSchema = amount("תקציב");

export async function updateBudgetTotal(eventId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await canManage(eventId))) return FORBIDDEN;
  const raw = String(formData.get("budgetTotal") ?? "");
  const parsed = budgetSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "יש לתקן את השדות המסומנים",
      fieldErrors: { budgetTotal: parsed.error.issues.map((i) => i.message) },
      values: { budgetTotal: raw },
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("events").update({ budget_total: parsed.data ?? 0 }).eq("id", eventId);
  if (error) return { ok: false, message: dbErrorMessage(error), values: { budgetTotal: raw } };
  revalidatePath(`/events/${eventId}`, "layout");
  return { ok: true, message: "התקציב עודכן" };
}
