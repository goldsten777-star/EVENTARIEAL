import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

export type SeatingTable = {
  id: string;
  number: number;
  name: string | null;
  capacity: number;
  shape: Enums["table_shape"];
};

export type SeatingGuest = {
  id: string;
  first_name: string;
  last_name: string;
  group_id: string | null;
  rsvp_status: Enums["rsvp_status"];
  seats_needed: number;
  table_id: string | null;
};

export type TableUsage = { used: number; free: number; over: boolean; guests: number };

export const guestName = (g: Pick<SeatingGuest, "first_name" | "last_name">) => `${g.first_name} ${g.last_name}`.trim();
export const tableLabel = (t: Pick<SeatingTable, "number" | "name">) => `שולחן ${t.number}${t.name ? ` · ${t.name}` : ""}`;

export function tableUsage(tables: SeatingTable[], guests: SeatingGuest[]): Map<string, TableUsage> {
  const usage = new Map<string, TableUsage>(tables.map((t) => [t.id, { used: 0, free: t.capacity, over: false, guests: 0 }]));
  for (const g of guests) {
    const u = g.table_id ? usage.get(g.table_id) : undefined;
    if (!u) continue;
    u.used += g.seats_needed;
    u.guests += 1;
  }
  for (const t of tables) {
    const u = usage.get(t.id)!;
    u.free = Math.max(t.capacity - u.used, 0);
    u.over = u.used > t.capacity;
  }
  return usage;
}

/**
 * Whether a guest fits at a table, mirroring the database trigger: seats
 * the guest already holds there count as available.
 */
export function fitsAt(table: SeatingTable, usage: TableUsage | undefined, guest: SeatingGuest) {
  const own = guest.table_id === table.id ? guest.seats_needed : 0;
  return (usage?.used ?? 0) - own + guest.seats_needed <= table.capacity;
}

export function noRoomMessage(table: SeatingTable, usage: TableUsage | undefined, guest: SeatingGuest) {
  const free = Math.max(table.capacity - (usage?.used ?? 0), 0);
  return `אין מספיק מקום בשולחן ${table.number}: נותרו ${free} מקומות, נדרשים ${guest.seats_needed}`;
}

export function nextTableNumber(tables: Pick<SeatingTable, "number">[]) {
  return tables.reduce((max, t) => Math.max(max, t.number), 0) + 1;
}

/** Guests still to seat: not declined and without a table, by group then name. */
export function waitingGuests(guests: SeatingGuest[], groupOrder: Map<string, number>) {
  return guests
    .filter((g) => !g.table_id && g.rsvp_status !== "declined")
    .sort(
      (a, b) =>
        (groupOrder.get(a.group_id ?? "") ?? 999) - (groupOrder.get(b.group_id ?? "") ?? 999) ||
        a.last_name.localeCompare(b.last_name, "he") ||
        a.first_name.localeCompare(b.first_name, "he"),
    );
}

export function seatingTotals(tables: SeatingTable[], guests: SeatingGuest[]) {
  const seated = guests.filter((g) => g.table_id);
  const waiting = guests.filter((g) => !g.table_id && g.rsvp_status !== "declined");
  return {
    tables: tables.length,
    capacity: tables.reduce((s, t) => s + t.capacity, 0),
    seatedPeople: seated.reduce((s, g) => s + g.seats_needed, 0),
    waitingPeople: waiting.reduce((s, g) => s + g.seats_needed, 0),
    waitingParties: waiting.length,
  };
}
