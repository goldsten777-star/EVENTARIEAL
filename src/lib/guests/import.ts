/**
 * Spreadsheet import: pure functions shared by the browser (preview) and the
 * server (final validation). No I/O here.
 */
import { normalizePhone } from "@/lib/phone";
import { guestSchema, type GuestInput } from "@/lib/validation/guest";
import type { Database } from "@/types/database";

type RsvpStatus = Database["public"]["Enums"]["rsvp_status"];

export const IMPORT_FIELDS = [
  { key: "firstName", label: "שם פרטי", required: true, synonyms: ["שם פרטי", "שם", "first name", "firstname", "name", "שם האורח"] },
  { key: "lastName", label: "שם משפחה", synonyms: ["שם משפחה", "משפחה", "last name", "lastname", "surname"] },
  { key: "phone", label: "טלפון", synonyms: ["טלפון", "נייד", "טלפון נייד", "מספר טלפון", "phone", "mobile", "cell", "פלאפון"] },
  { key: "email", label: "אימייל", synonyms: ["אימייל", "מייל", "דואל", "דוא\"ל", "email", "e-mail", "mail"] },
  { key: "group", label: "קבוצה", synonyms: ["קבוצה", "קבוצת השתייכות", "שיוך", "group", "category"] },
  { key: "inviterName", label: "שם המזמין", synonyms: ["שם המזמין", "מזמין", "צד", "inviter", "side", "invited by"] },
  { key: "invitedAdults", label: "מבוגרים", synonyms: ["מבוגרים", "מספר מבוגרים", "adults"] },
  { key: "invitedChildren", label: "ילדים", synonyms: ["ילדים", "מספר ילדים", "children", "kids"] },
  { key: "reservedSeats", label: "מקומות שמורים", synonyms: ["מקומות שמורים", "מקומות", "מספר מקומות", "כמות", "seats", "reserved"] },
  { key: "rsvpStatus", label: "אישור הגעה", synonyms: ["אישור הגעה", "סטטוס", "סטטוס הגעה", "rsvp", "status", "מגיע"] },
  { key: "confirmedAdults", label: "מבוגרים שאישרו", synonyms: ["מבוגרים שאישרו", "אישרו מבוגרים", "confirmed adults"] },
  { key: "confirmedChildren", label: "ילדים שאישרו", synonyms: ["ילדים שאישרו", "אישרו ילדים", "confirmed children"] },
  { key: "tableNumber", label: "מספר שולחן", synonyms: ["מספר שולחן", "שולחן", "table", "table number"] },
  { key: "dietary", label: "העדפות מזון", synonyms: ["העדפות מזון", "רגישויות", "תזונה", "אלרגיות", "dietary", "diet"] },
  { key: "dietaryNotes", label: "הערות תזונה", synonyms: ["הערות תזונה", "dietary notes"] },
  { key: "notes", label: "הערות", synonyms: ["הערות", "הערה", "notes", "note", "comments"] },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
export type ColumnMapping = Partial<Record<ImportFieldKey, number>>;
export type RawImportRow = Partial<Record<ImportFieldKey, string>>;

const clean = (s: string) => s.toLowerCase().replace(/["'׳״_\-\s]+/g, " ").trim();

/** Guesses which spreadsheet column holds which field, from the header row. */
export function autoMapHeaders(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<number>();
  for (const field of IMPORT_FIELDS) {
    const synonyms = field.synonyms.map(clean);
    // exact matches first, then "contains" matches
    let index = headers.findIndex((h, i) => !used.has(i) && synonyms.includes(clean(h)));
    if (index === -1) {
      index = headers.findIndex((h, i) => !used.has(i) && clean(h) !== "" && synonyms.some((s) => clean(h).includes(s)));
    }
    if (index !== -1) {
      mapping[field.key] = index;
      used.add(index);
    }
  }
  return mapping;
}

export function applyMapping(cells: string[], mapping: ColumnMapping): RawImportRow {
  const row: RawImportRow = {};
  for (const [key, index] of Object.entries(mapping) as Array<[ImportFieldKey, number]>) {
    row[key] = (cells[index] ?? "").trim();
  }
  return row;
}

const RSVP_WORDS: Array<[RsvpStatus, string[]]> = [
  ["declined", ["לא מגיע", "לא מגיעים", "לא", "סירב", "סירבו", "מסרב", "declined", "no"]],
  ["attending", ["מגיע", "מגיעים", "מגיעה", "כן", "אישר", "אישרו", "attending", "yes", "confirmed"]],
  ["maybe", ["אולי", "לא בטוח", "maybe"]],
  ["pending", ["ממתין", "ממתינים", "טרם", "pending", ""]],
];

export function parseRsvpStatus(value: string | undefined): RsvpStatus | null {
  const v = clean(value ?? "");
  for (const [status, words] of RSVP_WORDS) if (words.map(clean).includes(v)) return status;
  return null;
}

export type ParsedImportRow = {
  /** 1-based row number in the spreadsheet (header is row 1) */
  line: number;
  raw: RawImportRow;
  data: (Omit<GuestInput, "groupId" | "tableId"> & { groupName: string | null; tableNumber: number | null }) | null;
  errors: string[];
  duplicate: "file" | "existing" | null;
};

/** Validates one mapped row with the same schema as the guest form. */
export function parseImportRow(raw: RawImportRow, line: number): ParsedImportRow {
  const errors: string[] = [];
  const status = parseRsvpStatus(raw.rsvpStatus);
  if (raw.rsvpStatus && status === null) errors.push(`אישור הגעה לא מזוהה: "${raw.rsvpStatus}"`);

  const tableText = (raw.tableNumber ?? "").trim();
  const tableNumber = tableText === "" ? null : /^\d{1,3}$/.test(tableText) ? Number(tableText) : NaN;
  if (Number.isNaN(tableNumber)) errors.push(`מספר שולחן לא תקין: "${tableText}"`);

  // attending rows without explicit confirmed counts confirm everyone invited
  const adults = raw.invitedAdults ?? "";
  const children = raw.invitedChildren ?? "";
  const confirmedAdults =
    raw.confirmedAdults || (status === "attending" ? adults || "1" : "");
  const confirmedChildren = raw.confirmedChildren || (status === "attending" ? children : "");

  const result = guestSchema.safeParse({
    firstName: raw.firstName ?? "",
    lastName: raw.lastName ?? "",
    phone: raw.phone ?? "",
    email: raw.email ?? "",
    groupId: "",
    inviterName: raw.inviterName ?? "",
    invitedAdults: adults,
    invitedChildren: children,
    reservedSeats: raw.reservedSeats ?? "",
    rsvpStatus: status ?? "pending",
    confirmedAdults,
    confirmedChildren,
    tableId: "",
    dietaryTags: (raw.dietary ?? "")
      .split(/[,،;\n]+/)
      .map((t) => t.trim())
      .filter(Boolean),
    dietaryNotes: raw.dietaryNotes ?? "",
    notes: raw.notes ?? "",
  });

  if (!result.success) errors.push(...result.error.issues.map((i) => i.message));
  if (errors.length || !result.success) return { line, raw, data: null, errors, duplicate: null };

  const { groupId: _g, tableId: _t, ...rest } = result.data;
  void _g;
  void _t;
  return {
    line,
    raw,
    data: { ...rest, groupName: raw.group?.trim() || null, tableNumber: tableNumber as number | null },
    errors: [],
    duplicate: null,
  };
}

/** Marks rows whose phone repeats inside the file or already exists in the event. */
export function markDuplicates(rows: ParsedImportRow[], existingPhones: Iterable<string>) {
  const existing = new Set(existingPhones);
  const seen = new Set<string>();
  for (const row of rows) {
    const phone = row.data?.phone ?? normalizePhone(row.raw.phone);
    if (!phone) continue;
    if (existing.has(phone)) row.duplicate = "existing";
    else if (seen.has(phone)) row.duplicate = "file";
    seen.add(phone);
  }
  return rows;
}

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF, BOM). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  const delimiter = (input.split("\n")[0].match(/;/g)?.length ?? 0) > (input.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}
