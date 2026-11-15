import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getBudgetPageData(eventId: string) {
  const supabase = await createClient();
  const [event, expenses, gifts] = await Promise.all([
    supabase.from("events").select("budget_total").eq("id", eventId).single(),
    supabase
      .from("expenses")
      .select("id, category, vendor_name, description, planned_amount, actual_amount, paid_amount, due_date, notes, created_at")
      .eq("event_id", eventId)
      .order("created_at"),
    supabase.from("gifts").select("amount").eq("event_id", eventId),
  ]);
  if (expenses.error) throw expenses.error;
  return {
    budgetTotal: Number(event.data?.budget_total ?? 0),
    expenses: (expenses.data ?? []).map((e) => ({
      ...e,
      planned_amount: Number(e.planned_amount),
      actual_amount: Number(e.actual_amount),
      paid_amount: Number(e.paid_amount),
    })),
    giftsTotal: (gifts.data ?? []).reduce((s, g) => s + Number(g.amount), 0),
  };
}

export type BudgetPageData = Awaited<ReturnType<typeof getBudgetPageData>>;
export type ExpenseRow = BudgetPageData["expenses"][number];
