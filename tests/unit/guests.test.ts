import { describe, expect, it } from "vitest";
import {
  applyMapping,
  autoMapHeaders,
  markDuplicates,
  parseCsv,
  parseImportRow,
  parseRsvpStatus,
} from "@/lib/guests/import";
import { guestSchema, guestToRow } from "@/lib/validation/guest";

const form = {
  firstName: "דנה",
  lastName: "לוי",
  phone: "054-771-0932",
  email: "",
  groupId: "",
  inviterName: "",
  invitedAdults: "2",
  invitedChildren: "1",
  reservedSeats: "",
  rsvpStatus: "",
  confirmedAdults: "",
  confirmedChildren: "",
  tableId: "",
  dietaryTags: ["צמחוני", "צמחוני", ""],
  dietaryNotes: "",
  notes: "",
};

describe("guestSchema", () => {
  it("normalizes phone, defaults and tags", () => {
    const d = guestSchema.parse(form);
    expect(d.phone).toBe("+972547710932");
    expect(d.rsvpStatus).toBe("pending");
    expect(d.reservedSeats).toBeNull();
    expect(d.dietaryTags).toEqual(["צמחוני"]);
    expect(guestToRow(d).reserved_seats).toBe(3);
  });

  it.each([
    ["missing first name", { firstName: "  " }, "firstName"],
    ["bad phone", { phone: "12" }, "phone"],
    ["bad email", { email: "dana@" }, "email"],
    ["nobody invited", { invitedAdults: "0", invitedChildren: "0" }, "invitedAdults"],
    ["non-numeric adults", { invitedAdults: "שניים" }, "invitedAdults"],
    ["attending without adults", { rsvpStatus: "attending", confirmedAdults: "0" }, "confirmedAdults"],
    ["confirmed above reserved", { rsvpStatus: "attending", confirmedAdults: "3", confirmedChildren: "1" }, "confirmedAdults"],
    ["bad group id", { groupId: "abc" }, "groupId"],
  ])("rejects %s", (_l, override, field) => {
    const r = guestSchema.safeParse({ ...form, ...override });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path[0])).toContain(field);
  });

  it("accepts confirmed counts up to an explicit reserved number", () => {
    const r = guestSchema.safeParse({ ...form, reservedSeats: "5", rsvpStatus: "attending", confirmedAdults: "3", confirmedChildren: "2" });
    expect(r.success).toBe(true);
  });

  it("clears confirmed counts for declined guests", () => {
    const d = guestSchema.parse({ ...form, rsvpStatus: "declined", confirmedAdults: "2" });
    expect(guestToRow(d).confirmed_adults).toBe(0);
  });
});

describe("spreadsheet import", () => {
  it("maps Hebrew and English headers", () => {
    const m = autoMapHeaders(["שם פרטי", "שם משפחה", "נייד", "Email", "קבוצה", "צד", "מבוגרים", "ילדים", "סטטוס", "שולחן"]);
    expect(m).toMatchObject({
      firstName: 0, lastName: 1, phone: 2, email: 3, group: 4, inviterName: 5,
      invitedAdults: 6, invitedChildren: 7, rsvpStatus: 8, tableNumber: 9,
    });
  });

  it("does not map the same column twice", () => {
    const m = autoMapHeaders(["שם", "שם משפחה"]);
    expect(m.firstName).toBe(0);
    expect(m.lastName).toBe(1);
  });

  it.each([
    ["מגיעים", "attending"],
    ["כן", "attending"],
    ["לא מגיע", "declined"],
    ["אולי", "maybe"],
    ["", "pending"],
    ["משהו", null],
  ])("reads RSVP %j", (input, expected) => {
    expect(parseRsvpStatus(input)).toBe(expected);
  });

  it("parses a row, confirming everyone invited when marked attending", () => {
    const raw = applyMapping(["משפחת", "כהן", "501234567", "", "משפחה", "", "2", "2", "מגיעים", "4"], {
      firstName: 0, lastName: 1, phone: 2, email: 3, group: 4, inviterName: 5,
      invitedAdults: 6, invitedChildren: 7, rsvpStatus: 8, tableNumber: 9,
    });
    const r = parseImportRow(raw, 2);
    expect(r.errors).toEqual([]);
    expect(r.data).toMatchObject({
      phone: "+972501234567", groupName: "משפחה", tableNumber: 4,
      rsvpStatus: "attending", confirmedAdults: 2, confirmedChildren: 2,
    });
  });

  it("collects readable errors", () => {
    const r = parseImportRow({ firstName: "", phone: "abc", rsvpStatus: "בטוח", tableNumber: "A1" }, 7);
    expect(r.data).toBeNull();
    expect(r.errors).toEqual(
      expect.arrayContaining([
        'אישור הגעה לא מזוהה: "בטוח"',
        'מספר שולחן לא תקין: "A1"',
        "מספר טלפון לא תקין",
        "יש להזין שם פרטי (או 'משפחת')",
      ]),
    );
  });

  it("flags duplicates inside the file and against the event", () => {
    const rows = [
      parseImportRow({ firstName: "א", phone: "0501111111" }, 2),
      parseImportRow({ firstName: "ב", phone: "050-111-1111" }, 3),
      parseImportRow({ firstName: "ג", phone: "0502222222" }, 4),
      parseImportRow({ firstName: "ד" }, 5),
    ];
    markDuplicates(rows, ["+972502222222"]);
    expect(rows.map((r) => r.duplicate)).toEqual([null, "file", "existing", null]);
  });

  it("parses CSV with quotes, semicolons and BOM", () => {
    expect(parseCsv('﻿שם;טלפון\r\n"כהן; משה";050\r\n"אמר ""שלום""";051\n')).toEqual([
      ["שם", "טלפון"],
      ["כהן; משה", "050"],
      ['אמר "שלום"', "051"],
    ]);
  });
});
