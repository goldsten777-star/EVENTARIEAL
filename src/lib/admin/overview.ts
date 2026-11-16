import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

export type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  isPlatformAdmin: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  eventsOwned: number;
  eventsJoined: number;
};

export type AdminEvent = {
  id: string;
  name: string;
  eventType: Enums["event_type"];
  eventDate: string | null;
  status: Enums["event_status"];
  createdAt: string;
  ownerId: string;
  ownerEmail: string | null;
  ownerName: string | null;
  guests: number;
  members: number;
};

export type AdminTotals = {
  users: number;
  unconfirmedUsers: number;
  newUsers30d: number;
  admins: number;
  events: number;
  upcomingEvents: number;
  guests: number;
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);
const str = (v: unknown) => (typeof v === "string" ? v : null);
const rows = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v : []);

/** Maps the admin_overview() json into typed rows. */
export function parseAdminOverview(json: unknown): { users: AdminUser[]; events: AdminEvent[] } {
  const o = (json ?? {}) as Record<string, unknown>;
  return {
    users: rows(o.users).map((u) => ({
      id: String(u.id),
      email: String(u.email ?? ""),
      fullName: String(u.full_name ?? ""),
      isPlatformAdmin: u.is_platform_admin === true,
      createdAt: String(u.created_at),
      lastSignInAt: str(u.last_sign_in_at),
      emailConfirmed: u.email_confirmed === true,
      eventsOwned: num(u.events_owned),
      eventsJoined: num(u.events_joined),
    })),
    events: rows(o.events).map((e) => ({
      id: String(e.id),
      name: String(e.name ?? ""),
      eventType: e.event_type as Enums["event_type"],
      eventDate: str(e.event_date),
      status: e.status as Enums["event_status"],
      createdAt: String(e.created_at),
      ownerId: String(e.owner_id),
      ownerEmail: str(e.owner_email),
      ownerName: str(e.owner_name),
      guests: num(e.guests),
      members: num(e.members),
    })),
  };
}

const DAY = 24 * 60 * 60 * 1000;

export function adminTotals(users: AdminUser[], events: AdminEvent[], now: number): AdminTotals {
  return {
    users: users.length,
    unconfirmedUsers: users.filter((u) => !u.emailConfirmed).length,
    newUsers30d: users.filter((u) => now - Date.parse(u.createdAt) <= 30 * DAY).length,
    admins: users.filter((u) => u.isPlatformAdmin).length,
    events: events.length,
    upcomingEvents: events.filter((e) => e.eventDate && Date.parse(e.eventDate) >= now).length,
    guests: events.reduce((s, e) => s + e.guests, 0),
  };
}

/** Case-insensitive match on any of the given fields. */
export function matches(query: string, ...fields: Array<string | null | undefined>) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => f?.toLowerCase().includes(q));
}
