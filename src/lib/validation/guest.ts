import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { Constants } from "@/types/database";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} ארוך מדי (עד ${max} תווים)` });

const optionalText = (max: number, label: string) => text(max, label).transform((v) => (v === "" ? null : v));

/** A whole number field coming from a form or a spreadsheet cell. */
const count = (label: string, max: number, fallback: number | null) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+$/.test(v), { error: `${label}: יש להזין מספר שלם` })
    .transform((v) => (v === "" ? fallback : Number(v)))
    .refine((v) => v === null || v <= max, { error: `${label}: עד ${max}` });

const optionalUuid = z
  .string()
  .trim()
  .refine((v) => v === "" || UUID.test(v), { error: "בחירה לא תקינה" })
  .transform((v) => (v === "" ? null : v));

export const DIETARY_OPTIONS = [
  "צמחוני",
  "טבעוני",
  "ללא גלוטן",
  "ללא לקטוז",
  "כשר למהדרין",
  "אלרגיה לאגוזים",
  "מנת ילדים",
] as const;

export const guestSchema = z
  .object({
    firstName: text(80, "השם הפרטי").min(1, { error: "יש להזין שם פרטי (או 'משפחת')" }),
    lastName: text(80, "שם המשפחה"),
    phone: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (v === "") return null;
        const e164 = normalizePhone(v);
        if (!e164) {
          ctx.addIssue({ code: "custom", message: "מספר טלפון לא תקין" });
          return z.NEVER;
        }
        return e164;
      }),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .refine((v) => v === "" || z.email().safeParse(v).success, { error: "כתובת אימייל לא תקינה" })
      .transform((v) => (v === "" ? null : v)),
    groupId: optionalUuid,
    inviterName: optionalText(80, "שם המזמין"),
    invitedAdults: count("מבוגרים", 50, 1),
    invitedChildren: count("ילדים", 50, 0),
    reservedSeats: count("מקומות שמורים", 100, null),
    rsvpStatus: z
      .string()
      .transform((v) => (v === "" ? "pending" : v))
      .pipe(z.enum(Constants.public.Enums.rsvp_status, { error: "סטטוס לא תקין" })),
    confirmedAdults: count("מבוגרים שאישרו", 100, 0),
    confirmedChildren: count("ילדים שאישרו", 100, 0),
    tableId: optionalUuid,
    dietaryTags: z
      .array(text(40, "העדפת מזון"))
      .max(10, { error: "עד 10 העדפות מזון" })
      .transform((tags) => [...new Set(tags.filter(Boolean))]),
    dietaryNotes: optionalText(500, "הערות התזונה"),
    notes: optionalText(1000, "ההערות"),
  })
  .superRefine((d, ctx) => {
    const invited = (d.invitedAdults ?? 0) + (d.invitedChildren ?? 0);
    if (invited < 1) {
      ctx.addIssue({ code: "custom", path: ["invitedAdults"], message: "יש להזמין לפחות אדם אחד" });
    }
    if (d.reservedSeats !== null && d.reservedSeats < 1) {
      ctx.addIssue({ code: "custom", path: ["reservedSeats"], message: "יש לשמור לפחות מקום אחד" });
    }
    if (d.rsvpStatus === "attending") {
      const reserved = d.reservedSeats ?? invited;
      const confirmed = (d.confirmedAdults ?? 0) + (d.confirmedChildren ?? 0);
      if ((d.confirmedAdults ?? 0) < 1) {
        ctx.addIssue({ code: "custom", path: ["confirmedAdults"], message: "במצב 'מגיעים' יש לציין לפחות מבוגר אחד" });
      } else if (confirmed > reserved) {
        ctx.addIssue({
          code: "custom",
          path: ["confirmedAdults"],
          message: `אישרו ${confirmed} אבל נשמרו רק ${reserved} מקומות. הגדילו את מספר המקומות השמורים.`,
        });
      }
    }
  });

export type GuestInput = z.infer<typeof guestSchema>;

export const GUEST_FIELDS = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "groupId",
  "inviterName",
  "invitedAdults",
  "invitedChildren",
  "reservedSeats",
  "rsvpStatus",
  "confirmedAdults",
  "confirmedChildren",
  "tableId",
  "dietaryNotes",
  "notes",
] as const;

export function guestFormInput(fd: FormData) {
  const input: Record<string, unknown> = Object.fromEntries(
    GUEST_FIELDS.map((k) => [k, String(fd.get(k) ?? "")]),
  );
  input.dietaryTags = fd.getAll("dietaryTags").map(String);
  return input;
}

/** Database row for insert/update. */
export function guestToRow(d: GuestInput) {
  const attending = d.rsvpStatus === "attending";
  return {
    first_name: d.firstName,
    last_name: d.lastName,
    phone: d.phone,
    email: d.email,
    group_id: d.groupId,
    inviter_name: d.inviterName,
    invited_adults: d.invitedAdults ?? 1,
    invited_children: d.invitedChildren ?? 0,
    reserved_seats: d.reservedSeats ?? (d.invitedAdults ?? 0) + (d.invitedChildren ?? 0),
    rsvp_status: d.rsvpStatus,
    confirmed_adults: attending || d.rsvpStatus === "maybe" ? (d.confirmedAdults ?? 0) : 0,
    confirmed_children: attending || d.rsvpStatus === "maybe" ? (d.confirmedChildren ?? 0) : 0,
    table_id: d.tableId,
    dietary_tags: d.dietaryTags,
    dietary_notes: d.dietaryNotes,
    notes: d.notes,
  };
}

export const bulkActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("group"), groupId: z.string().regex(UUID).nullable() }),
  z.object({ type: z.literal("invitation"), status: z.enum(Constants.public.Enums.invitation_status) }),
  z.object({ type: z.literal("delete") }),
]);
export type BulkAction = z.infer<typeof bulkActionSchema>;

export const guestIdsSchema = z.array(z.string().regex(UUID)).min(1).max(2000);
