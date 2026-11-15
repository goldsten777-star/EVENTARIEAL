"use client";

/**
 * Excel helpers that run in the browser. exceljs (~1 MB) is loaded only when
 * the user actually exports or imports.
 */
import { downloadBuffer as download, loadExcel, safeFileName, styleHeader } from "@/lib/excel/export";
import { formatPhone } from "@/lib/phone";
import { IMPORT_FIELDS } from "@/lib/guests/import";
import { INVITATION_LABELS, RSVP_LABELS } from "@/lib/labels-guests";
import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

export type ExportGuest = {
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  inviter_name: string | null;
  invited_adults: number;
  invited_children: number;
  reserved_seats: number;
  invitation_status: Enums["invitation_status"];
  rsvp_status: Enums["rsvp_status"];
  confirmed_adults: number;
  confirmed_children: number;
  dietary_tags: string[];
  dietary_notes: string | null;
  notes: string | null;
  rsvp_note: string | null;
  groupName: string;
  tableNumber: number | null;
};

const COLUMNS: Array<{ header: string; width: number; value: (g: ExportGuest) => string | number }> = [
  { header: "שם פרטי", width: 16, value: (g) => g.first_name },
  { header: "שם משפחה", width: 16, value: (g) => g.last_name },
  { header: "טלפון", width: 15, value: (g) => formatPhone(g.phone) },
  { header: "אימייל", width: 24, value: (g) => g.email ?? "" },
  { header: "קבוצה", width: 12, value: (g) => g.groupName },
  { header: "שם המזמין", width: 14, value: (g) => g.inviter_name ?? "" },
  { header: "מבוגרים", width: 9, value: (g) => g.invited_adults },
  { header: "ילדים", width: 8, value: (g) => g.invited_children },
  { header: "מקומות שמורים", width: 13, value: (g) => g.reserved_seats },
  { header: "סטטוס הזמנה", width: 12, value: (g) => INVITATION_LABELS[g.invitation_status] },
  { header: "אישור הגעה", width: 12, value: (g) => RSVP_LABELS[g.rsvp_status] },
  { header: "מבוגרים שאישרו", width: 14, value: (g) => g.confirmed_adults },
  { header: "ילדים שאישרו", width: 13, value: (g) => g.confirmed_children },
  { header: "מספר שולחן", width: 11, value: (g) => g.tableNumber ?? "" },
  { header: "העדפות מזון", width: 20, value: (g) => g.dietary_tags.join(", ") },
  { header: "הערות תזונה", width: 20, value: (g) => g.dietary_notes ?? "" },
  { header: "הערות", width: 24, value: (g) => g.notes ?? "" },
  { header: "הערת האורח", width: 24, value: (g) => g.rsvp_note ?? "" },
];

export async function exportGuestsToExcel(eventName: string, guests: ExportGuest[]) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Event Manager";
  const ws = wb.addWorksheet("מוזמנים", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  ws.columns = COLUMNS.map((c) => ({ header: c.header, width: c.width }));
  styleHeader(ws.getRow(1));
  for (const g of guests) ws.addRow(COLUMNS.map((c) => c.value(g)));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };
  const date = new Date().toISOString().slice(0, 10);
  download(await wb.xlsx.writeBuffer(), `${safeFileName(eventName)} - מוזמנים ${date}.xlsx`);
}

export async function downloadImportTemplate() {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("מוזמנים", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  ws.columns = IMPORT_FIELDS.map((f) => ({ header: f.label, width: Math.max(12, f.label.length + 4) }));
  styleHeader(ws.getRow(1));
  const example: Record<string, string | number> = {
    firstName: "משפחת",
    lastName: "כהן",
    phone: "050-1234567",
    email: "cohen@example.com",
    group: "משפחה",
    inviterName: "צד הכלה",
    invitedAdults: 2,
    invitedChildren: 2,
    reservedSeats: 4,
    rsvpStatus: "ממתין",
    dietary: "צמחוני, ללא גלוטן",
  };
  ws.addRow(IMPORT_FIELDS.map((f) => example[f.key] ?? ""));
  ws.getColumn(IMPORT_FIELDS.findIndex((f) => f.key === "phone") + 1).numFmt = "@";
  const help = wb.addWorksheet("הסבר", { views: [{ rightToLeft: true }] });
  help.columns = [{ width: 22 }, { width: 70 }];
  [
    ["עמודה", "הסבר"],
    ["שם פרטי", "חובה. למשפחה אפשר לכתוב 'משפחת' ובשם המשפחה את שם המשפחה."],
    ["טלפון", "מומלץ. מספרים כפולים מזוהים אוטומטית."],
    ["קבוצה", "קבוצה שלא קיימת תיווצר בייבוא."],
    ["אישור הגעה", "מגיעים / לא מגיעים / אולי / ממתין. ריק = ממתין."],
    ["מספר שולחן", "רק שולחנות שכבר הוגדרו באירוע."],
    ["העדפות מזון", "מופרדות בפסיק."],
  ].forEach((r, i) => {
    const row = help.addRow(r);
    if (i === 0) styleHeader(row);
  });
  download(await wb.xlsx.writeBuffer(), "תבנית ייבוא מוזמנים.xlsx");
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as { text?: string; result?: unknown; richText?: Array<{ text: string }> };
    if (v.richText) return v.richText.map((r) => r.text).join("");
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return cellText(v.result);
    return "";
  }
  return String(value).trim();
}

export type SheetRow = { line: number; cells: string[] };

/** Reads the first sheet of an .xlsx file; `line` is the row number shown in Excel. */
export async function readXlsx(file: File): Promise<SheetRow[]> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: SheetRow[] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= ws.columnCount; c++) cells.push(cellText(row.getCell(c).value));
    if (cells.some((x) => x !== "")) rows.push({ line: row.number, cells });
  });
  return rows;
}
