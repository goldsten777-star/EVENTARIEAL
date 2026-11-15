import { z } from "zod";
import { amount, isoDate, notes } from "@/lib/validation/money";
import { Constants } from "@/types/database";

export const expenseSchema = z
  .object({
    category: z.enum(Constants.public.Enums.expense_category, { error: "יש לבחור קטגוריה" }),
    vendorName: z
      .string()
      .trim()
      .max(120, { error: "שם הספק ארוך מדי" })
      .transform((v) => (v === "" ? null : v)),
    description: notes(500),
    plannedAmount: amount("מתוכנן"),
    actualAmount: amount("בפועל"),
    paidAmount: amount("שולם"),
    dueDate: isoDate,
    notes: notes(500),
  })
  .superRefine((d, ctx) => {
    if (!d.vendorName && !d.description) {
      ctx.addIssue({ code: "custom", path: ["vendorName"], message: "יש להזין ספק או תיאור" });
    }
    if ((d.paidAmount ?? 0) > Math.max(d.actualAmount ?? 0, d.plannedAmount ?? 0)) {
      ctx.addIssue({ code: "custom", path: ["paidAmount"], message: "הסכום ששולם גבוה מעלות ההוצאה" });
    }
  });

export function expenseFormInput(fd: FormData) {
  const s = (k: string) => String(fd.get(k) ?? "");
  return {
    category: s("category"),
    vendorName: s("vendorName"),
    description: s("description"),
    plannedAmount: s("plannedAmount"),
    actualAmount: s("actualAmount"),
    paidAmount: s("paidAmount"),
    dueDate: s("dueDate"),
    notes: s("notes"),
  };
}

/** Payment state of one expense line. */
export function paymentStatus(e: { actual_amount: number; planned_amount: number; paid_amount: number }) {
  const cost = e.actual_amount || e.planned_amount;
  if (cost <= 0) return "none" as const;
  if (e.paid_amount >= cost) return "paid" as const;
  if (e.paid_amount > 0) return "partial" as const;
  return "unpaid" as const;
}
