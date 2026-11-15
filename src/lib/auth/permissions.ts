import type { Database } from "@/types/database";

export type EventRole = Database["public"]["Enums"]["member_role"];

/**
 * What each role may do inside an event. The database enforces the same
 * rules with RLS; this mirror only decides what the UI shows.
 */
export type Capability = "view" | "manage" | "checkin";

const MATRIX: Record<Capability, readonly EventRole[]> = {
  view: ["event_manager", "viewer"],
  manage: ["event_manager"],
  checkin: ["event_manager", "checkin"],
};

export function can(role: EventRole | null | undefined, capability: Capability) {
  return !!role && MATRIX[capability].includes(role);
}

export const ROLE_LABELS: Record<EventRole, string> = {
  event_manager: "מנהל/ת אירוע",
  viewer: "צפייה בלבד",
  checkin: "צוות כניסה",
};

export const ROLE_DESCRIPTIONS: Record<EventRole, string> = {
  event_manager: "גישה מלאה לכל נתוני האירוע וניהול הצוות",
  viewer: "צפייה בכל הנתונים ללא אפשרות לשנות",
  checkin: "גישה למסך הכניסה ביום האירוע בלבד",
};

/** The page a role lands on when opening an event. */
export function eventHomePath(eventId: string, role: EventRole) {
  return role === "checkin" ? `/events/${eventId}/checkin` : `/events/${eventId}/dashboard`;
}

export type EventSection =
  | "dashboard"
  | "guests"
  | "invitations"
  | "seating"
  | "gifts"
  | "budget"
  | "checkin"
  | "reports"
  | "settings";

export const SECTION_CAPABILITY: Record<EventSection, Capability> = {
  dashboard: "view",
  guests: "view",
  invitations: "view",
  seating: "view",
  gifts: "view",
  budget: "view",
  checkin: "checkin",
  reports: "view",
  settings: "manage",
};
