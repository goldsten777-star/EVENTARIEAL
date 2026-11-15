/**
 * Report builders: pure functions from guest/table rows to a printable,
 * exportable report (summary figures + one or more tabular sections).
 */
import { formatPhone } from "@/lib/phone";
import { INVITATION_LABELS, RSVP_LABELS } from "@/lib/labels-guests";
import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

export type ReportGuest = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  inviter_name: string | null;
  rsvp_status: Enums["rsvp_status"];
  invitation_status: Enums["invitation_status"];
  invited_adults: number;
  invited_children: number;
  reserved_seats: number;
  confirmed_adults: number;
  confirmed_children: number;
  seats_needed: number | null;
  dietary_tags: string[];
  dietary_notes: string | null;
  rsvp_note: string | null;
  table_id: string | null;
  group_name: string | null;
  checked_in_at: string | null;
  arrived_count: number | null;
};

export type ReportTable = { id: string; number: number; name: string | null; capacity: number };

export type ReportColumn = { key: string; label: string; numeric?: boolean };
export type ReportSection = {
  title: string;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number>>;
  footer?: Record<string, string | number>;
  empty: string;
};
export type Report = {
  summary: Array<{ label: string; value: string | number }>;
  sections: ReportSection[];
};

export const REPORTS = {
  seating: { title: "אורחים לפי שולחן", description: "מי יושב בכל שולחן, כמה מקומות ומי עוד לא שובץ." },
  catering: { title: "רגישויות מזון לקייטרינג", description: "מספר המנות, העדפות ורגישויות לפי אורח ושולחן." },
  rsvp: { title: "מעקב אישורי הגעה", description: "מי עוד לא ענה, עם טלפון לשיחת תזכורת." },
  attendance: { title: "נוכחות בפועל", description: "מי נכנס לאירוע, ומי אישר הגעה ולא הגיע." },
} as const;
export type ReportKey = keyof typeof REPORTS;
export const isReportKey = (v: string): v is ReportKey => v in REPORTS;

const name = (g: ReportGuest) => `${g.first_name} ${g.last_name}`.trim();
const people = (g: ReportGuest) => g.confirmed_adults + g.confirmed_children;
const byName = (a: ReportGuest, b: ReportGuest) => name(a).localeCompare(name(b), "he");
const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
const time = (iso: string) =>
  new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function buildSeatingReport(guests: ReportGuest[], tables: ReportTable[]): Report {
  const tableById = new Map(tables.map((t) => [t.id, t]));
  const seated = guests.filter((g) => g.table_id && tableById.has(g.table_id));
  const unseated = guests.filter((g) => !g.table_id && g.rsvp_status !== "declined");
  const used = new Map<string, number>();
  for (const g of seated) used.set(g.table_id!, (used.get(g.table_id!) ?? 0) + (g.seats_needed ?? 0));
  const overfull = tables.filter((t) => (used.get(t.id) ?? 0) > t.capacity).length;

  const rows = [...seated]
    .sort((a, b) => tableById.get(a.table_id!)!.number - tableById.get(b.table_id!)!.number || byName(a, b))
    .map((g) => {
      const t = tableById.get(g.table_id!)!;
      return {
        table: t.number,
        tableName: t.name ?? "",
        guest: name(g),
        seats: g.seats_needed ?? 0,
        status: RSVP_LABELS[g.rsvp_status],
        group: g.group_name ?? "",
        diet: g.dietary_tags.join(", "),
      };
    });
  const tableRows = [...tables]
    .sort((a, b) => a.number - b.number)
    .map((t) => ({ table: t.number, tableName: t.name ?? "", seats: used.get(t.id) ?? 0, capacity: t.capacity, free: t.capacity - (used.get(t.id) ?? 0) }));

  return {
    summary: [
      { label: "שולחנות", value: tables.length },
      { label: "מקומות ששובצו", value: sum(seated, (g) => g.seats_needed ?? 0) },
      { label: "ממתינים לשיבוץ", value: sum(unseated, (g) => g.seats_needed ?? 0) },
      { label: "שולחנות בחריגה", value: overfull },
    ],
    sections: [
      {
        title: "שיבוץ לפי שולחן",
        columns: [
          { key: "table", label: "שולחן", numeric: true },
          { key: "tableName", label: "שם השולחן" },
          { key: "guest", label: "אורח" },
          { key: "seats", label: "מקומות", numeric: true },
          { key: "status", label: "אישור הגעה" },
          { key: "group", label: "קבוצה" },
          { key: "diet", label: "תזונה" },
        ],
        rows,
        empty: "עוד לא שובצו אורחים לשולחנות.",
      },
      {
        title: "תפוסת שולחנות",
        columns: [
          { key: "table", label: "שולחן", numeric: true },
          { key: "tableName", label: "שם" },
          { key: "seats", label: "תפוסים", numeric: true },
          { key: "capacity", label: "מקומות", numeric: true },
          { key: "free", label: "פנויים", numeric: true },
        ],
        rows: tableRows,
        empty: "עוד לא הוגדרו שולחנות.",
      },
      {
        title: "ללא שולחן",
        columns: [
          { key: "guest", label: "אורח" },
          { key: "seats", label: "מקומות", numeric: true },
          { key: "status", label: "אישור הגעה" },
          { key: "group", label: "קבוצה" },
        ],
        rows: [...unseated].sort(byName).map((g) => ({
          guest: name(g),
          seats: g.seats_needed ?? 0,
          status: RSVP_LABELS[g.rsvp_status],
          group: g.group_name ?? "",
        })),
        empty: "כל האורחים שובצו.",
      },
    ],
  };
}

export function buildCateringReport(guests: ReportGuest[], tables: ReportTable[]): Report {
  const tableNumber = new Map(tables.map((t) => [t.id, t.number]));
  const attending = guests.filter((g) => g.rsvp_status === "attending");
  const pending = guests.filter((g) => g.rsvp_status === "pending" || g.rsvp_status === "maybe");

  const tags = new Map<string, { parties: number; people: number }>();
  for (const g of attending) {
    for (const t of g.dietary_tags) {
      const cur = tags.get(t) ?? { parties: 0, people: 0 };
      tags.set(t, { parties: cur.parties + 1, people: cur.people + people(g) });
    }
  }
  const special = attending.filter((g) => g.dietary_tags.length || g.dietary_notes || g.rsvp_note);

  return {
    summary: [
      { label: "מנות (אישרו הגעה)", value: sum(attending, people) },
      { label: "מבוגרים", value: sum(attending, (g) => g.confirmed_adults) },
      { label: "ילדים", value: sum(attending, (g) => g.confirmed_children) },
      { label: "טרם ענו (מקומות)", value: sum(pending, (g) => g.reserved_seats) },
    ],
    sections: [
      {
        title: "סיכום לפי העדפה",
        columns: [
          { key: "tag", label: "העדפה / רגישות" },
          { key: "parties", label: "הזמנות", numeric: true },
          { key: "people", label: "אנשים בהזמנות אלו", numeric: true },
        ],
        rows: [...tags.entries()].sort((a, b) => b[1].people - a[1].people).map(([tag, v]) => ({ tag, ...v })),
        empty: "אין העדפות מזון מיוחדות בין מי שאישרו.",
      },
      {
        title: "פירוט לפי אורח",
        columns: [
          { key: "guest", label: "אורח" },
          { key: "table", label: "שולחן" },
          { key: "people", label: "משתתפים", numeric: true },
          { key: "tags", label: "העדפות" },
          { key: "notes", label: "הערות תזונה" },
          { key: "guestNote", label: "הערת האורח" },
        ],
        rows: [...special].sort(byName).map((g) => ({
          guest: name(g),
          table: g.table_id ? (tableNumber.get(g.table_id) ?? "") : "",
          people: people(g),
          tags: g.dietary_tags.join(", "),
          notes: g.dietary_notes ?? "",
          guestNote: g.rsvp_note ?? "",
        })),
        empty: "אין אורחים עם העדפות או הערות.",
      },
    ],
  };
}

export function buildRsvpReport(guests: ReportGuest[]): Report {
  const order = { not_sent: 0, sent: 1, viewed: 2 } as const;
  const open = guests
    .filter((g) => g.rsvp_status === "pending" || g.rsvp_status === "maybe")
    .sort((a, b) => order[a.invitation_status] - order[b.invitation_status] || byName(a, b));
  return {
    summary: [
      { label: "ממתינים לתשובה (הזמנות)", value: open.length },
      { label: "מקומות שמורים", value: sum(open, (g) => g.reserved_seats) },
      { label: "הזמנות שלא נשלחו", value: open.filter((g) => g.invitation_status === "not_sent").length },
      { label: "פתחו ולא ענו", value: open.filter((g) => g.invitation_status === "viewed").length },
    ],
    sections: [
      {
        title: "לא ענו עדיין",
        columns: [
          { key: "guest", label: "אורח" },
          { key: "phone", label: "טלפון" },
          { key: "seats", label: "מקומות", numeric: true },
          { key: "invitation", label: "הזמנה" },
          { key: "status", label: "סטטוס" },
          { key: "group", label: "קבוצה" },
          { key: "inviter", label: "מזמין" },
        ],
        rows: open.map((g) => ({
          guest: name(g),
          phone: formatPhone(g.phone),
          seats: g.reserved_seats,
          invitation: INVITATION_LABELS[g.invitation_status],
          status: RSVP_LABELS[g.rsvp_status],
          group: g.group_name ?? "",
          inviter: g.inviter_name ?? "",
        })),
        empty: "כל המוזמנים ענו.",
      },
    ],
  };
}

export function buildAttendanceReport(guests: ReportGuest[], tables: ReportTable[]): Report {
  const tableNumber = new Map(tables.map((t) => [t.id, t.number]));
  const arrived = guests.filter((g) => g.checked_in_at).sort((a, b) => a.checked_in_at!.localeCompare(b.checked_in_at!));
  const noShow = guests.filter((g) => g.rsvp_status === "attending" && !g.checked_in_at).sort(byName);
  const attendingPeople = sum(guests.filter((g) => g.rsvp_status === "attending"), people);
  return {
    summary: [
      { label: "הגיעו (אנשים)", value: sum(arrived, (g) => g.arrived_count ?? 0) },
      { label: "אישרו הגעה (אנשים)", value: attendingPeople },
      { label: "הזמנות שנכנסו", value: arrived.length },
      { label: "אישרו ולא הגיעו (הזמנות)", value: noShow.length },
    ],
    sections: [
      {
        title: "נכנסו לאירוע",
        columns: [
          { key: "time", label: "שעה" },
          { key: "guest", label: "אורח" },
          { key: "table", label: "שולחן" },
          { key: "arrived", label: "הגיעו", numeric: true },
          { key: "expected", label: "אישרו", numeric: true },
        ],
        rows: arrived.map((g) => ({
          time: time(g.checked_in_at!),
          guest: name(g),
          table: g.table_id ? (tableNumber.get(g.table_id) ?? "") : "",
          arrived: g.arrived_count ?? 0,
          expected: people(g),
        })),
        empty: "עוד לא נרשמו כניסות. הנתונים יתמלאו ביום האירוע.",
      },
      {
        title: "אישרו ולא הגיעו",
        columns: [
          { key: "guest", label: "אורח" },
          { key: "phone", label: "טלפון" },
          { key: "table", label: "שולחן" },
          { key: "expected", label: "אישרו", numeric: true },
        ],
        rows: noShow.map((g) => ({
          guest: name(g),
          phone: formatPhone(g.phone),
          table: g.table_id ? (tableNumber.get(g.table_id) ?? "") : "",
          expected: people(g),
        })),
        empty: "כל מי שאישר הגעה נכנס.",
      },
    ],
  };
}

export function buildReport(key: ReportKey, guests: ReportGuest[], tables: ReportTable[]): Report {
  switch (key) {
    case "seating":
      return buildSeatingReport(guests, tables);
    case "catering":
      return buildCateringReport(guests, tables);
    case "rsvp":
      return buildRsvpReport(guests);
    case "attendance":
      return buildAttendanceReport(guests, tables);
  }
}
