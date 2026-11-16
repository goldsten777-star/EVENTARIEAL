import { describe, expect, it } from "vitest";
import { fitsAt, nextTableNumber, noRoomMessage, seatingTotals, tableUsage, waitingGuests, type SeatingGuest, type SeatingTable } from "@/lib/seating/plan";
import { tableFormInput, tableSchema } from "@/lib/validation/table";

const T1: SeatingTable = { id: "t1", number: 1, name: "משפחה", capacity: 10, shape: "round" };
const T2: SeatingTable = { id: "t2", number: 4, name: null, capacity: 4, shape: "rectangle" };
const g = (id: string, seats: number, table: string | null, extra: Partial<SeatingGuest> = {}): SeatingGuest => ({
  id, first_name: "א", last_name: id, group_id: null, rsvp_status: "attending", seats_needed: seats, table_id: table, ...extra,
});

describe("seating plan", () => {
  const guests = [g("a", 4, "t1"), g("b", 5, "t1"), g("c", 3, null), g("d", 2, "t2"), g("e", 3, "t2"), g("f", 0, null, { rsvp_status: "declined" })];

  it("adds up used and free seats and flags overfull tables", () => {
    const u = tableUsage([T1, T2], guests);
    expect(u.get("t1")).toEqual({ used: 9, free: 1, over: false, guests: 2 });
    expect(u.get("t2")).toEqual({ used: 5, free: 0, over: true, guests: 2 });
  });

  it("checks fit like the database trigger, counting the guest's own seats", () => {
    const u = tableUsage([T1, T2], guests);
    expect(fitsAt(T1, u.get("t1"), g("x", 1, null))).toBe(true);
    expect(fitsAt(T1, u.get("t1"), g("x", 2, null))).toBe(false);
    expect(fitsAt(T1, u.get("t1"), guests[1])).toBe(true); // already there
    expect(noRoomMessage(T1, u.get("t1"), g("x", 3, null))).toBe("אין מספיק מקום בשולחן 1: נותרו 1 מקומות, נדרשים 3");
  });

  it("lists who still needs a seat and totals the room", () => {
    expect(waitingGuests(guests, new Map()).map((x) => x.id)).toEqual(["c"]);
    expect(seatingTotals([T1, T2], guests)).toEqual({ tables: 2, capacity: 14, seatedPeople: 14, waitingPeople: 3, waitingParties: 1 });
    expect(nextTableNumber([T1, T2])).toBe(5);
    expect(nextTableNumber([])).toBe(1);
  });
});

describe("table form", () => {
  const fd = (o: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  };

  it("accepts a table and a batch of tables", () => {
    expect(tableSchema.parse(tableFormInput(fd({ number: "3", name: " דודים ", capacity: "12", shape: "round" })))).toEqual({
      number: 3, count: 1, name: "דודים", capacity: 12, shape: "round",
    });
    expect(tableSchema.parse(tableFormInput(fd({ number: "10", count: "5", name: "", capacity: "10", shape: "knight" }))).name).toBeNull();
  });

  it("explains bad values", () => {
    const r = tableSchema.safeParse(tableFormInput(fd({ number: "0", count: "1", name: "", capacity: "abc", shape: "round" })));
    expect(r.success).toBe(false);
    const issues = Object.fromEntries(r.error!.issues.map((i) => [i.path[0], i.message]));
    expect(issues.number).toBe("מספר שולחן: לפחות 1");
    expect(issues.capacity).toBe("מקומות: יש להזין מספר שלם");
    const over = tableSchema.safeParse(tableFormInput(fd({ number: "990", count: "20", name: "", capacity: "10", shape: "round" })));
    expect(over.error!.issues[0].message).toBe("מספרי השולחנות יעברו את 999");
  });
});
