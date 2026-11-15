import { z } from "zod";
import { isValidLocalDateTime } from "@/lib/datetime";
import { Constants } from "@/types/database";

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} ארוך מדי (עד ${max} תווים)` })
    .transform((v) => (v === "" ? null : v));

const optionalLocalDateTime = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidLocalDateTime(v), { error: "תאריך או שעה לא תקינים" })
  .transform((v) => (v === "" ? null : v));

export const eventSchema = z
  .object({
    name: z
      .string({ error: "יש להזין שם לאירוע" })
      .trim()
      .min(2, { error: "יש להזין שם לאירוע (לפחות 2 תווים)" })
      .max(120, { error: "שם האירוע ארוך מדי" }),
    eventType: z.enum(Constants.public.Enums.event_type, { error: "יש לבחור סוג אירוע" }),
    hostNames: optionalText(120, "שם המארחים"),
    eventDate: optionalLocalDateTime,
    venueName: optionalText(120, "שם המקום"),
    venueAddress: optionalText(200, "הכתובת"),
    rsvpDeadline: optionalLocalDateTime,
    budgetTotal: z
      .string()
      .trim()
      .transform((v) => v.replace(/[,₪\s]/g, ""))
      .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), { error: "יש להזין סכום חיובי" })
      .transform((v) => (v === "" ? 0 : Number(v)))
      .refine((v) => v <= 100_000_000, { error: "הסכום גבוה מדי" }),
  })
  .refine((d) => !d.eventDate || !d.rsvpDeadline || d.rsvpDeadline <= d.eventDate, {
    path: ["rsvpDeadline"],
    error: "המועד האחרון לאישור הגעה חייב להיות לפני האירוע",
  });

export const eventSettingsSchema = eventSchema.and(
  z.object({
    status: z.enum(Constants.public.Enums.event_status, { error: "סטטוס לא תקין" }),
    invitationMessage: optionalText(2000, "נוסח ההזמנה"),
  }),
);

export type EventInput = z.infer<typeof eventSchema>;

export function eventFormInput(fd: FormData) {
  const s = (k: string) => String(fd.get(k) ?? "");
  return {
    name: s("name"),
    eventType: s("eventType"),
    hostNames: s("hostNames"),
    eventDate: s("eventDate"),
    venueName: s("venueName"),
    venueAddress: s("venueAddress"),
    rsvpDeadline: s("rsvpDeadline"),
    budgetTotal: s("budgetTotal"),
    status: s("status"),
    invitationMessage: s("invitationMessage"),
  };
}

export const deleteEventSchema = z.object({ confirmName: z.string().trim() });

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: "יש להזין אימייל" })
    .pipe(z.email({ error: "כתובת אימייל לא תקינה" }))
    .transform((v) => v.toLowerCase()),
  role: z.enum(Constants.public.Enums.member_role, { error: "יש לבחור תפקיד" }),
});

export const groupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "יש להזין שם קבוצה" })
    .max(60, { error: "שם הקבוצה ארוך מדי" }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "צבע לא תקין" }),
});
