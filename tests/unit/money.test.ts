import { describe, expect, it } from "vitest";
import { expenseSchema, paymentStatus } from "@/lib/validation/expense";
import { giftSchema } from "@/lib/validation/gift";

const gift = { guestId: "", amount: "1,500", paymentMethod: "bit", receivedAt: "2026-11-15", notes: "" };

describe("giftSchema", () => {
  it("parses amounts written with commas and shekel signs", () => {
    expect(giftSchema.parse(gift).amount).toBe(1500);
    expect(giftSchema.parse({ ...gift, amount: "₪ 720.50" }).amount).toBe(720.5);
  });
  it("requires an amount unless it is a non-cash gift", () => {
    expect(giftSchema.safeParse({ ...gift, amount: "" }).success).toBe(false);
    expect(giftSchema.safeParse({ ...gift, amount: "", paymentMethod: "gift_item" }).success).toBe(true);
  });
  it.each([
    ["amount", { amount: "-5" }],
    ["amount", { amount: "abc" }],
    ["paymentMethod", { paymentMethod: "crypto" }],
    ["receivedAt", { receivedAt: "15/11/2026" }],
    ["receivedAt", { receivedAt: "" }],
    ["guestId", { guestId: "not-a-uuid" }],
  ])("rejects a bad %s", (field, override) => {
    const r = giftSchema.safeParse({ ...gift, ...override });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path[0])).toContain(field);
  });
});

const expense = {
  category: "catering",
  vendorName: "קייטרינג טעמים",
  description: "",
  plannedAmount: "72,000",
  actualAmount: "48000",
  paidAmount: "10000",
  dueDate: "2027-03-05",
  notes: "",
};

describe("expenseSchema", () => {
  it("parses amounts and empty fields", () => {
    const d = expenseSchema.parse({ ...expense, dueDate: "" });
    expect(d).toMatchObject({ plannedAmount: 72000, actualAmount: 48000, paidAmount: 10000, dueDate: null, description: null });
  });
  it("needs a vendor or a description", () => {
    const r = expenseSchema.safeParse({ ...expense, vendorName: "" });
    expect(r.error!.issues[0].path).toEqual(["vendorName"]);
    expect(expenseSchema.safeParse({ ...expense, vendorName: "", description: "הסעות" }).success).toBe(true);
  });
  it("refuses paying more than the cost", () => {
    const r = expenseSchema.safeParse({ ...expense, paidAmount: "80000" });
    expect(r.error!.issues[0].path).toEqual(["paidAmount"]);
  });
});

describe("paymentStatus", () => {
  it.each([
    [{ actual_amount: 100, planned_amount: 0, paid_amount: 100 }, "paid"],
    [{ actual_amount: 100, planned_amount: 0, paid_amount: 40 }, "partial"],
    [{ actual_amount: 0, planned_amount: 100, paid_amount: 0 }, "unpaid"],
    [{ actual_amount: 0, planned_amount: 0, paid_amount: 0 }, "none"],
  ] as const)("%o → %s", (e, expected) => {
    expect(paymentStatus(e)).toBe(expected);
  });
});
