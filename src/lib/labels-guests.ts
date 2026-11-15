import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

export const RSVP_LABELS: Record<Enums["rsvp_status"], string> = {
  pending: "ממתין",
  attending: "מגיעים",
  declined: "לא מגיעים",
  maybe: "אולי",
};

export const INVITATION_LABELS: Record<Enums["invitation_status"], string> = {
  not_sent: "לא נשלחה",
  sent: "נשלחה",
  viewed: "נצפתה",
};

/** Badge colors (light/dark aware tokens) per RSVP status. */
export const RSVP_TONE: Record<Enums["rsvp_status"], string> = {
  attending: "bg-success-soft text-success",
  declined: "bg-destructive-soft text-destructive",
  pending: "bg-warning-soft text-warning",
  maybe: "bg-accent text-accent-foreground",
};
