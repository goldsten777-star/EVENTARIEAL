import { describe, expect, it } from "vitest";
import { can, eventHomePath, SECTION_CAPABILITY, type EventRole } from "@/lib/auth/permissions";
import { authErrorMessage, dbErrorMessage } from "@/lib/errors";
import { safeNextPath } from "@/lib/safe-redirect";
import { countdownLabel, daysUntil } from "@/lib/format";

describe("safeNextPath", () => {
  it.each([
    ["/events/123", "/events/123"],
    ["/events?tab=1", "/events?tab=1"],
    ["//evil.com", "/events"],
    ["/\\evil.com", "/events"],
    ["https://evil.com", "/events"],
    ["javascript:alert(1)", "/events"],
    [null, "/events"],
    [undefined, "/events"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("permissions", () => {
  const allowed = (role: EventRole) =>
    (Object.keys(SECTION_CAPABILITY) as Array<keyof typeof SECTION_CAPABILITY>).filter((s) =>
      can(role, SECTION_CAPABILITY[s]),
    );

  it("event managers see every section", () => {
    expect(allowed("event_manager")).toHaveLength(9);
  });
  it("viewers see everything except check-in and settings", () => {
    expect(allowed("viewer")).not.toContain("checkin");
    expect(allowed("viewer")).not.toContain("settings");
    expect(allowed("viewer")).toContain("guests");
  });
  it("check-in staff see only the check-in screen", () => {
    expect(allowed("checkin")).toEqual(["checkin"]);
  });
  it("nobody without a role can do anything", () => {
    expect(can(null, "view")).toBe(false);
  });
  it("sends each role to its home page", () => {
    expect(eventHomePath("e1", "checkin")).toBe("/events/e1/checkin");
    expect(eventHomePath("e1", "viewer")).toBe("/events/e1/dashboard");
  });
});

describe("error messages", () => {
  it("translates known auth errors", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toBe("אימייל או סיסמה שגויים");
    expect(authErrorMessage({ status: 429 })).toContain("יותר מדי");
    expect(authErrorMessage({ code: "something_new" })).toContain("שגיאה");
  });
  it("passes through Hebrew messages raised by the database", () => {
    expect(dbErrorMessage({ code: "P0001", message: "אין מספיק מקום בשולחן 3" })).toBe("אין מספיק מקום בשולחן 3");
    expect(dbErrorMessage({ code: "42501" })).toContain("הרשאה");
  });
});

describe("countdown", () => {
  const now = new Date("2027-03-01T10:00:00+02:00");
  it("counts whole days in Israel time", () => {
    expect(daysUntil("2027-03-12T19:30:00+02:00", now)).toBe(11);
    expect(daysUntil("2027-03-01T23:30:00+02:00", now)).toBe(0);
    expect(daysUntil(null, now)).toBeNull();
  });
  it("labels the countdown", () => {
    expect(countdownLabel(11)).toBe("עוד 11 ימים לאירוע");
    expect(countdownLabel(0)).toBe("האירוע היום");
    expect(countdownLabel(1)).toBe("האירוע מחר");
    expect(countdownLabel(-3)).toBe("האירוע היה לפני 3 ימים");
  });
});
