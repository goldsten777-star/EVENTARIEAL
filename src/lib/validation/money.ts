import { z } from "zod";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Money typed by a person: "1,500", "₪ 1500.50" → 1500.5; empty → fallback. */
export const amount = (label: string, fallback: number | null = 0) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/[,₪\s]/g, ""))
    .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), { error: `${label}: יש להזין סכום חיובי` })
    .transform((v) => (v === "" ? fallback : Number(v)))
    .refine((v) => v === null || v <= 10_000_000, { error: `${label}: הסכום גבוה מדי` });

export const isoDate = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))), {
    error: "תאריך לא תקין",
  })
  .transform((v) => (v === "" ? null : v));

export const optionalUuid = z
  .string()
  .trim()
  .refine((v) => v === "" || UUID.test(v), { error: "בחירה לא תקינה" })
  .transform((v) => (v === "" ? null : v));

export const notes = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `ההערה ארוכה מדי (עד ${max} תווים)` })
    .transform((v) => (v === "" ? null : v));
