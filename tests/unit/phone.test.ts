import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone, whatsappNumber } from "@/lib/phone";

describe("normalizePhone", () => {
  it.each([
    ["050-123-4567", "+972501234567"],
    ["0501234567", "+972501234567"],
    ["+972 50 123 4567", "+972501234567"],
    ["00972501234567", "+972501234567"],
    ["03-1234567", "+97231234567"],
    ["+1 212 555 0100", "+12125550100"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "   ", "abc", "123", "050-12"])("rejects %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("handles null and undefined", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
});

describe("formatPhone", () => {
  it("shows Israeli numbers in local form", () => {
    expect(formatPhone("+972501234567")).toBe("050-123-4567");
  });
  it("shows foreign numbers in international form", () => {
    expect(formatPhone("+12125550100")).toBe("+1 212 555 0100");
  });
  it("returns empty string for empty input", () => {
    expect(formatPhone(null)).toBe("");
  });
});

describe("whatsappNumber", () => {
  it("strips the plus sign", () => {
    expect(whatsappNumber("+972501234567")).toBe("972501234567");
  });
});
