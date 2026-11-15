import { describe, expect, it } from "vitest";
import {
  buildAttendanceReport,
  buildCateringReport,
  buildRsvpReport,
  buildSeatingReport,
  type ReportGuest,
} from "@/lib/reports/build";

const base: ReportGuest = {
  id: "g",
  first_name: "דנה",
  last_name: "לוי",
  phone: "+972501234567",
  inviter_name: null,
  rsvp_status: "pending",
  invitation_status: "sent",
  invited_adults: 2,
  invited_children: 0,
  reserved_seats: 2,
  confirmed_adults: 0,
  confirmed_children: 0,
  seats_needed: 2,
  dietary_tags: [],
  dietary_notes: null,
  rsvp_note: null,
  table_id: null,
  group_name: null,
  checked_in_at: null,
  arrived_count: null,
};
const g = (o: Partial<ReportGuest>) => ({ ...base, ...o });
const tables = [
  { id: "t1", number: 1, name: "משפחה", capacity: 4 },
  { id: "t2", number: 2, name: null, capacity: 10 },
];

describe("seating report", () => {
  const r = buildSeatingReport(
    [
      g({ id: "a", first_name: "בני", table_id: "t2", rsvp_status: "attending", confirmed_adults: 2, seats_needed: 2 }),
      g({ id: "b", first_name: "אבי", table_id: "t1", rsvp_status: "attending", confirmed_adults: 3, confirmed_children: 2, seats_needed: 5 }),
      g({ id: "c", first_name: "גיל", seats_needed: 2 }),
      g({ id: "d", first_name: "דן", rsvp_status: "declined", seats_needed: 0 }),
    ],
    tables,
  );
  it("orders by table number and lists the unseated (not declined)", () => {
    expect(r.sections[0].rows.map((x) => x.guest)).toEqual(["אבי לוי", "בני לוי"]);
    expect(r.sections[2].rows.map((x) => x.guest)).toEqual(["גיל לוי"]);
  });
  it("computes occupancy and over-full tables", () => {
    expect(r.sections[1].rows).toEqual([
      { table: 1, tableName: "משפחה", seats: 5, capacity: 4, free: -1 },
      { table: 2, tableName: "", seats: 2, capacity: 10, free: 8 },
    ]);
    expect(r.summary.find((s) => s.label === "שולחנות בחריגה")!.value).toBe(1);
  });
});

describe("catering report", () => {
  const r = buildCateringReport(
    [
      g({ rsvp_status: "attending", confirmed_adults: 2, confirmed_children: 1, dietary_tags: ["צמחוני"], table_id: "t1" }),
      g({ id: "x", first_name: "רון", rsvp_status: "attending", confirmed_adults: 1, dietary_tags: ["צמחוני", "ללא גלוטן"] }),
      g({ id: "y", rsvp_status: "attending", confirmed_adults: 2 }),
      g({ id: "z", rsvp_status: "declined", dietary_tags: ["טבעוני"] }),
      g({ id: "w", rsvp_status: "pending", reserved_seats: 4 }),
    ],
    tables,
  );
  it("counts meals from those attending only", () => {
    expect(r.summary.map((s) => s.value)).toEqual([6, 5, 1, 4]);
  });
  it("summarizes tags by parties and people", () => {
    expect(r.sections[0].rows).toEqual([
      { tag: "צמחוני", parties: 2, people: 4 },
      { tag: "ללא גלוטן", parties: 1, people: 1 },
    ]);
    expect(r.sections[1].rows).toHaveLength(2);
    expect(r.sections[1].rows[0]).toMatchObject({ guest: "דנה לוי", table: 1, people: 3 });
  });
});

describe("RSVP follow-up report", () => {
  it("lists unanswered guests, not-sent invitations first, with local phone", () => {
    const r = buildRsvpReport([
      g({ id: "1", first_name: "בני", invitation_status: "viewed" }),
      g({ id: "2", first_name: "אבי", invitation_status: "not_sent", rsvp_status: "maybe" }),
      g({ id: "3", rsvp_status: "attending", confirmed_adults: 1 }),
    ]);
    expect(r.sections[0].rows.map((x) => x.guest)).toEqual(["אבי לוי", "בני לוי"]);
    expect(r.sections[0].rows[0].phone).toBe("050-123-4567");
    expect(r.summary[2].value).toBe(1);
  });
});

describe("attendance report", () => {
  it("splits arrivals from no-shows", () => {
    const r = buildAttendanceReport(
      [
        g({ rsvp_status: "attending", confirmed_adults: 2, checked_in_at: "2027-03-12T18:05:00Z", arrived_count: 2 }),
        g({ id: "n", first_name: "רון", rsvp_status: "attending", confirmed_adults: 3 }),
      ],
      tables,
    );
    expect(r.summary.map((s) => s.value)).toEqual([2, 5, 1, 1]);
    expect(r.sections[0].rows[0]).toMatchObject({ time: "20:05", guest: "דנה לוי", arrived: 2 });
    expect(r.sections[1].rows[0]).toMatchObject({ guest: "רון לוי", expected: 3 });
  });
});
