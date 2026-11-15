import { z } from "zod";
import { amount, isoDate, notes, optionalUuid } from "@/lib/validation/money";
import { Constants } from "@/types/database";

export const giftSchema = z
  .object({
    guestId: optionalUuid,
    amount: amount("סכום", null),
    paymentMethod: z.enum(Constants.public.Enums.payment_method, { error: "יש לבחור אמצעי תשלום" }),
    receivedAt: isoDate,
    notes: notes(500),
  })
  .superRefine((d, ctx) => {
    if (d.paymentMethod !== "gift_item" && (d.amount === null || d.amount <= 0)) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "יש להזין סכום" });
    }
    if (!d.receivedAt) ctx.addIssue({ code: "custom", path: ["receivedAt"], message: "יש לבחור תאריך" });
  });

export function giftFormInput(fd: FormData) {
  const s = (k: string) => String(fd.get(k) ?? "");
  return {
    guestId: s("guestId"),
    amount: s("amount"),
    paymentMethod: s("paymentMethod"),
    receivedAt: s("receivedAt"),
    notes: s("notes"),
  };
}
