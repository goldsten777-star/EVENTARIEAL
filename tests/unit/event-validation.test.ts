import { describe, expect, it } from "vitest";
import { isoToIsraelLocal, israelLocalToIso, isValidLocalDateTime } from "@/lib/datetime";
import { eventSchema, eventSettingsSchema, inviteMemberSchema } from "@/lib/validation/event";

describe("Israel time conversion", () => {
  it("handles winter time (UTC+2)", () => {
    expect(israelLocalToIso("2027-01-12T19:30")).toBe("2027-01-12T17:30:00.000Z");
    expect(isoToIsraelLocal("2027-01-12T17:30:00.000Z")).toBe("2027-01-12T19:30");
  });
  it("handles summer time (UTC+3)", () => {
    expect(israelLocalToIso("2027-07-01T20:00")).toBe("2027-07-01T17:00:00.000Z");
    expect(isoToIsraelLocal("2027-07-01T17:00:00+00:00")).toBe("2027-07-01T20:00");
  });
  it("round-trips across the year", () => {
    for (const local of ["2026-03-27T10:00", "2026-10-25T09:00", "2027-12-31T23:59", "2027-03-12T19:30"]) {
      expect(isoToIsraelLocal(israelLocalToIso(local))).toBe(local);
    }
  });
  it("validates the input format", () => {
    expect(isValidLocalDateTime("2027-02-30T10:00")).toBe(false);
    expect(isValidLocalDateTime("2027-02-28T24:00")).toBe(false);
    expect(isValidLocalDateTime("2027-02-28 10:00")).toBe(false);
    expect(isValidLocalDateTime("2027-02-28T10:00")).toBe(true);
  });
  it("returns empty string for empty values", () => {
    expect(isoToIsraelLocal(null)).toBe("");
  });
});

const base = {
  name: "חתונה",
  eventType: "wedding",
  hostNames: "",
  eventDate: "2027-03-12T19:30",
  venueName: "",
  venueAddress: "",
  rsvpDeadline: "",
  budgetTotal: "",
};

describe("eventSchema", () => {
  it("turns empty optional fields into null and budget into a number", () => {
    const r = eventSchema.parse({ ...base, budgetTotal: "₪184,500" });
    expect(r.hostNames).toBeNull();
    expect(r.rsvpDeadline).toBeNull();
    expect(r.budgetTotal).toBe(184500);
  });
  it("requires the RSVP deadline to be before the event", () => {
    const r = eventSchema.safeParse({ ...base, rsvpDeadline: "2027-03-13T10:00" });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].path).toEqual(["rsvpDeadline"]);
  });
  it.each([
    ["name", { name: "א" }],
    ["eventType", { eventType: "party" }],
    ["budgetTotal", { budgetTotal: "-5" }],
    ["budgetTotal", { budgetTotal: "abc" }],
    ["eventDate", { eventDate: "2027-13-01T10:00" }],
  ])("rejects a bad %s", (field, override) => {
    const r = eventSchema.safeParse({ ...base, ...override });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path[0])).toContain(field);
  });
  it("settings also validate status and message", () => {
    expect(eventSettingsSchema.safeParse({ ...base, status: "active", invitationMessage: "" }).success).toBe(true);
    expect(eventSettingsSchema.safeParse({ ...base, status: "deleted", invitationMessage: "" }).success).toBe(false);
  });
});

describe("inviteMemberSchema", () => {
  it("normalizes the email and checks the role", () => {
    expect(inviteMemberSchema.parse({ email: " Dana@Example.COM ", role: "viewer" }).email).toBe("dana@example.com");
    expect(inviteMemberSchema.safeParse({ email: "dana@example.com", role: "owner" }).success).toBe(false);
  });
});
