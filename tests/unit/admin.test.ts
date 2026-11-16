import { describe, expect, it } from "vitest";
import { adminTotals, matches, parseAdminOverview } from "@/lib/admin/overview";

const NOW = Date.parse("2026-11-16T12:00:00Z");

const raw = {
  users: [
    { id: "u1", email: "a@x.com", full_name: "אבי", is_platform_admin: true, created_at: "2026-11-15T10:00:00Z", last_sign_in_at: "2026-11-16T08:00:00Z", email_confirmed: true, events_owned: 1, events_joined: 1 },
    { id: "u2", email: "b@x.com", full_name: "", is_platform_admin: false, created_at: "2026-01-01T10:00:00Z", last_sign_in_at: null, email_confirmed: false, events_owned: 0, events_joined: 2 },
  ],
  events: [
    { id: "e1", name: "חתונה", event_type: "wedding", event_date: "2027-03-12T17:30:00Z", status: "active", created_at: "2026-11-15T10:00:00Z", owner_id: "u1", owner_email: "a@x.com", owner_name: "אבי", guests: 150, members: 3 },
    { id: "e2", name: "כנס", event_type: "corporate", event_date: "2026-01-25T07:00:00Z", status: "completed", created_at: "2026-01-02T10:00:00Z", owner_id: "u2", owner_email: null, owner_name: null, guests: 5, members: 1 },
    { id: "e3", name: "טיוטה", event_type: "other", event_date: null, status: "draft", created_at: "2026-11-16T10:00:00Z", owner_id: "u2", owner_email: "b@x.com", owner_name: "", guests: 0, members: 1 },
  ],
};

describe("admin overview", () => {
  it("parses users and events from the RPC json", () => {
    const { users, events } = parseAdminOverview(raw);
    expect(users[0]).toEqual({
      id: "u1", email: "a@x.com", fullName: "אבי", isPlatformAdmin: true, createdAt: "2026-11-15T10:00:00Z",
      lastSignInAt: "2026-11-16T08:00:00Z", emailConfirmed: true, eventsOwned: 1, eventsJoined: 1,
    });
    expect(users[1]).toMatchObject({ isPlatformAdmin: false, lastSignInAt: null, emailConfirmed: false });
    expect(events[1]).toMatchObject({ eventType: "corporate", ownerEmail: null, guests: 5 });
    expect(parseAdminOverview(null)).toEqual({ users: [], events: [] });
  });

  it("totals users, unconfirmed and recent sign-ups, upcoming events and guests", () => {
    const { users, events } = parseAdminOverview(raw);
    expect(adminTotals(users, events, NOW)).toEqual({
      users: 2, unconfirmedUsers: 1, newUsers30d: 1, admins: 1, events: 3, upcomingEvents: 1, guests: 155,
    });
  });

  it("searches any field without case", () => {
    expect(matches("", "x")).toBe(true);
    expect(matches("A@X", "a@x.com")).toBe(true);
    expect(matches("חתו", null, "חתונה")).toBe(true);
    expect(matches("zzz", "a", undefined)).toBe(false);
  });
});
