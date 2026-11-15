/**
 * Integration tests for RLS policies, triggers and RPCs, run against the
 * real Supabase project through the public API, as each seeded role.
 * Every row these tests create is removed in afterAll.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, EVENTS, signIn, testPhone, USERS, type Db } from "./helpers";

let admin: Db, manager: Db, viewer: Db, checkin: Db, outsider: Db;
const cleanup: Array<() => PromiseLike<unknown>> = [];

beforeAll(async () => {
  [admin, manager, viewer, checkin, outsider] = await Promise.all([
    signIn("admin"),
    signIn("manager"),
    signIn("viewer"),
    signIn("checkin"),
    signIn("outsider"),
  ]);
});

afterAll(async () => {
  for (const fn of cleanup.reverse()) await fn();
});

async function createGuest(fields: { adults?: number; children?: number; event?: string } = {}) {
  const { data, error } = await manager
    .from("guests")
    .insert({
      event_id: fields.event ?? EVENTS.wedding,
      first_name: "בדיקה",
      last_name: `אוטומטית ${Date.now()}`,
      phone: testPhone(),
      invited_adults: fields.adults ?? 2,
      invited_children: fields.children ?? 0,
    })
    .select()
    .single();
  expect(error).toBeNull();
  cleanup.push(() => manager.from("guests").delete().eq("id", data!.id));
  return data!;
}

describe("anonymous visitor", () => {
  const anon = anonClient();

  it("cannot read any table", async () => {
    for (const table of ["events", "guests", "gifts", "expenses", "profiles"] as const) {
      const { data, error } = await anon.from(table).select("id").limit(1);
      expect(error?.code, table).toBe("42501");
      expect(data).toBeNull();
    }
  });

  it("cannot call staff RPCs", async () => {
    const { error } = await anon.rpc("event_stats", { p_event_id: EVENTS.wedding });
    expect(error?.code).toBe("42501");
  });

  it("gets nothing for an unknown RSVP token", async () => {
    const { data, error } = await anon.rpc("get_rsvp", { p_token: "x".repeat(24) });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});

describe("public RSVP flow", () => {
  it("reads the invitation, validates counts and records the answer", async () => {
    const guest = await createGuest({ adults: 2, children: 0 });
    expect(guest.reserved_seats).toBe(2); // filled from adults + children
    expect(guest.invite_token).toHaveLength(24); // server-generated

    const anon = anonClient();
    const { data: invitation } = await anon.rpc("get_rsvp", { p_token: guest.invite_token });
    const inv = invitation as { guest: { first_name: string; reserved_seats: number }; event: { name: string }; is_open: boolean };
    expect(inv.guest.first_name).toBe("בדיקה");
    expect(inv.guest.reserved_seats).toBe(2);
    expect(inv.event.name).toBe("חתונת נועה ואיתי");
    expect(inv.is_open).toBe(true);
    // the invitation does not leak internal fields
    expect(JSON.stringify(invitation)).not.toContain(guest.id);
    expect(JSON.stringify(invitation)).not.toContain("phone");

    const tooMany = await anon.rpc("submit_rsvp", {
      p_token: guest.invite_token,
      p_status: "attending",
      p_adults: 2,
      p_children: 1,
    });
    expect(tooMany.error?.hint).toBe("too_many_people");

    const noAdult = await anon.rpc("submit_rsvp", {
      p_token: guest.invite_token,
      p_status: "attending",
      p_adults: 0,
      p_children: 1,
    });
    expect(noAdult.error?.hint).toBe("invalid_counts");

    const ok = await anon.rpc("submit_rsvp", {
      p_token: guest.invite_token,
      p_status: "attending",
      p_adults: 1,
      p_children: 1,
      p_note: "  מנה צמחונית  ",
    });
    expect(ok.error).toBeNull();

    const { data: row } = await manager.from("guests").select("*").eq("id", guest.id).single();
    expect(row).toMatchObject({
      rsvp_status: "attending",
      confirmed_adults: 1,
      confirmed_children: 1,
      rsvp_note: "מנה צמחונית",
      invitation_status: "viewed",
      seats_needed: 2,
    });
    expect(row!.rsvp_responded_at).not.toBeNull();

    const { data: log } = await manager
      .from("activity_log")
      .select("action, payload")
      .eq("guest_id", guest.id)
      .eq("action", "rsvp_updated");
    expect(log).toHaveLength(1);
    expect(log![0].payload).toMatchObject({ by_guest: true, to: "attending" });

    // declining clears the confirmed counts
    await anon.rpc("submit_rsvp", { p_token: guest.invite_token, p_status: "declined" });
    const { data: declined } = await manager.from("guests").select("*").eq("id", guest.id).single();
    expect(declined).toMatchObject({ rsvp_status: "declined", confirmed_adults: 0, seats_needed: 0 });
  });

  it("rejects answers after the RSVP deadline", async () => {
    const guest = await createGuest({ event: EVENTS.barMitzvah });
    await manager.from("events").update({ rsvp_deadline: "2020-01-01T00:00:00Z" }).eq("id", EVENTS.barMitzvah);
    cleanup.push(() => manager.from("events").update({ rsvp_deadline: null }).eq("id", EVENTS.barMitzvah));

    const anon = anonClient();
    const { data } = await anon.rpc("get_rsvp", { p_token: guest.invite_token });
    expect((data as { is_open: boolean }).is_open).toBe(false);

    const { error } = await anon.rpc("submit_rsvp", {
      p_token: guest.invite_token,
      p_status: "declined",
    });
    expect(error?.hint).toBe("rsvp_closed");
  });
});

describe("event manager", () => {
  it("sees only their own events", async () => {
    const { data } = await manager.from("events").select("id");
    const ids = data!.map((e) => e.id).sort();
    expect(ids).toEqual([EVENTS.wedding, EVENTS.barMitzvah].sort());
  });

  it("cannot write into someone else's event", async () => {
    const { error } = await manager
      .from("guests")
      .insert({ event_id: EVENTS.conference, first_name: "פולש" });
    expect(error?.code).toBe("42501");
  });

  it("is blocked from duplicate phone numbers in the same event", async () => {
    const guest = await createGuest();
    const { error } = await manager
      .from("guests")
      .insert({ event_id: EVENTS.wedding, first_name: "כפול", phone: guest.phone });
    expect(error?.code).toBe("23505");
  });

  it("cannot overfill a table", async () => {
    const { data: table, error: tableError } = await manager
      .from("seating_tables")
      .insert({ event_id: EVENTS.wedding, number: 900 + Math.floor(Math.random() * 99), capacity: 3 })
      .select()
      .single();
    expect(tableError).toBeNull();
    cleanup.push(() => manager.from("seating_tables").delete().eq("id", table!.id));

    const first = await createGuest({ adults: 2 });
    const second = await createGuest({ adults: 2 });

    const ok = await manager.from("guests").update({ table_id: table!.id }).eq("id", first.id);
    expect(ok.error).toBeNull();

    const over = await manager.from("guests").update({ table_id: table!.id }).eq("id", second.id);
    expect(over.error?.hint).toBe("table_capacity_exceeded");
    expect(over.error?.message).toContain("אין מספיק מקום");

    // growing a seated party beyond capacity is blocked too
    const grow = await manager
      .from("guests")
      .update({ invited_adults: 4, reserved_seats: 4 })
      .eq("id", first.id);
    expect(grow.error?.hint).toBe("table_capacity_exceeded");

    // shrinking the table below its occupancy is blocked
    const shrink = await manager.from("seating_tables").update({ capacity: 1 }).eq("id", table!.id);
    expect(shrink.error?.hint).toBe("table_capacity_exceeded");
  });

  it("cannot forge check-in data or invite tokens through a plain update", async () => {
    const guest = await createGuest();
    const { data } = await manager
      .from("guests")
      .update({
        checked_in_at: new Date().toISOString(),
        arrived_count: 5,
        invite_token: "forged-token-forged-token",
        event_id: EVENTS.barMitzvah,
      })
      .eq("id", guest.id)
      .select()
      .single();
    expect(data).toMatchObject({
      checked_in_at: null,
      arrived_count: null,
      invite_token: guest.invite_token,
      event_id: EVENTS.wedding,
    });
  });

  it("creates an event, becoming its manager with default groups, and deletes it", async () => {
    const { data: event, error } = await manager
      .from("events")
      .insert({ name: "אירוע בדיקה" })
      .select()
      .single();
    expect(error).toBeNull();
    expect(event!.owner_id).toBe(USERS.manager.id);

    const { data: members } = await manager.from("event_members").select("user_id, role").eq("event_id", event!.id);
    expect(members).toEqual([{ user_id: USERS.manager.id, role: "event_manager" }]);

    const { data: groups } = await manager.from("guest_groups").select("name").eq("event_id", event!.id);
    expect(groups!.map((g) => g.name).sort()).toEqual(["אחרים", "חברים", "משפחה", "עבודה"].sort());

    const del = await manager.from("events").delete().eq("id", event!.id).select();
    expect(del.error).toBeNull();
    expect(del.data).toHaveLength(1);
  });

  it("cannot remove or demote the event owner", async () => {
    const del = await manager
      .from("event_members")
      .delete()
      .eq("event_id", EVENTS.wedding)
      .eq("user_id", USERS.manager.id);
    expect(del.error?.hint).toBe("owner_membership_protected");

    const demote = await manager
      .from("event_members")
      .update({ role: "viewer" })
      .eq("event_id", EVENTS.wedding)
      .eq("user_id", USERS.manager.id);
    expect(demote.error?.hint).toBe("owner_membership_protected");
  });

  it("adds existing users to the team and invites new emails", async () => {
    const added = await manager.rpc("invite_member", {
      p_event_id: EVENTS.barMitzvah,
      p_email: "Outsider@Example.com",
      p_role: "viewer",
    });
    expect(added.error).toBeNull();
    expect(added.data).toMatchObject({ status: "added" });

    // the new viewer can now read that event's guests…
    const { data: seen } = await outsider.from("guests").select("id").eq("event_id", EVENTS.barMitzvah);
    expect(seen!.length).toBeGreaterThan(0);

    // …and loses access as soon as they are removed
    const removed = await manager
      .from("event_members")
      .delete()
      .eq("event_id", EVENTS.barMitzvah)
      .eq("user_id", USERS.outsider.id)
      .select();
    expect(removed.data).toHaveLength(1);
    const { data: after } = await outsider.from("guests").select("id").eq("event_id", EVENTS.barMitzvah);
    expect(after).toEqual([]);

    const invited = await manager.rpc("invite_member", {
      p_event_id: EVENTS.barMitzvah,
      p_email: `new-staff-${Date.now()}@example.com`,
      p_role: "checkin",
    });
    expect(invited.data).toMatchObject({ status: "invited" });
    cleanup.push(() => manager.from("event_member_invites").delete().eq("event_id", EVENTS.barMitzvah));

    const bad = await manager.rpc("invite_member", {
      p_event_id: EVENTS.barMitzvah,
      p_email: "not-an-email",
      p_role: "viewer",
    });
    expect(bad.error?.hint).toBe("invalid_email");
  });

  it("gets consistent dashboard statistics", async () => {
    const { data, error } = await manager.rpc("event_stats", { p_event_id: EVENTS.wedding });
    expect(error).toBeNull();
    const stats = data as {
      totals: Record<string, number>;
      tables: Record<string, number>;
      money: Record<string, number>;
      by_group: Array<{ invited: number }>;
    };
    const t = stats.totals;
    expect(t.parties).toBeGreaterThanOrEqual(150);
    expect(t.attending_parties + t.declined_parties + t.pending_parties).toBe(t.parties);
    expect(stats.tables.tables_count).toBeGreaterThanOrEqual(15);
    expect(stats.money.budget_total).toBe(184500);
    expect(stats.money.planned_total).toBe(184500);
    expect(stats.money.actual_total).toBe(142300);
    const groupInvited = stats.by_group.reduce((sum, g) => sum + g.invited, 0);
    expect(groupInvited).toBe(t.people_invited);
  });
});

describe("viewer", () => {
  it("reads their event but nothing else", async () => {
    const { data: events } = await viewer.from("events").select("id");
    expect(events!.map((e) => e.id)).toEqual([EVENTS.wedding]);

    const { data: guests } = await viewer.from("guests").select("id").eq("event_id", EVENTS.wedding);
    expect(guests!.length).toBeGreaterThanOrEqual(150);

    const { data: other } = await viewer.from("guests").select("id").eq("event_id", EVENTS.barMitzvah);
    expect(other).toEqual([]);

    const { error } = await viewer.rpc("event_stats", { p_event_id: EVENTS.wedding });
    expect(error).toBeNull();
  });

  it("cannot change anything", async () => {
    const insert = await viewer.from("guests").insert({ event_id: EVENTS.wedding, first_name: "x" });
    expect(insert.error?.code).toBe("42501");

    const update = await viewer
      .from("guests")
      .update({ notes: "hacked" })
      .eq("event_id", EVENTS.wedding)
      .select();
    expect(update.data).toEqual([]);

    const del = await viewer.from("expenses").delete().eq("event_id", EVENTS.wedding).select();
    expect(del.data).toEqual([]);

    const event = await viewer.from("events").update({ name: "hacked" }).eq("id", EVENTS.wedding).select();
    expect(event.data).toEqual([]);

    const invite = await viewer.rpc("invite_member", {
      p_event_id: EVENTS.wedding,
      p_email: "x@example.com",
      p_role: "event_manager",
    });
    expect(invite.error?.code).toBe("42501");

    const checkIn = await viewer.rpc("checkin_search", { p_event_id: EVENTS.wedding });
    expect(checkIn.error?.code).toBe("42501");
  });
});

describe("check-in staff", () => {
  it("has no direct access to guest, gift or budget data", async () => {
    for (const table of ["guests", "gifts", "expenses", "seating_tables"] as const) {
      const { data } = await checkin.from(table).select("id").eq("event_id", EVENTS.wedding);
      expect(data, table).toEqual([]);
    }
    const stats = await checkin.rpc("event_stats", { p_event_id: EVENTS.wedding });
    expect(stats.error?.code).toBe("42501");
  });

  it("searches guests and checks them in exactly once", async () => {
    const guest = await createGuest({ adults: 2, children: 1 });

    const byName = await checkin.rpc("checkin_search", {
      p_event_id: EVENTS.wedding,
      p_query: guest.last_name,
    });
    expect(byName.error).toBeNull();
    expect(byName.data!.map((g) => g.id)).toContain(guest.id);
    // only door fields are returned
    expect(Object.keys(byName.data![0])).not.toContain("invite_token");

    const localPhone = "0" + guest.phone!.slice(4); // +97258... → 058...
    const byPhone = await checkin.rpc("checkin_search", { p_event_id: EVENTS.wedding, p_query: localPhone });
    expect(byPhone.data!.map((g) => g.id)).toContain(guest.id);

    const byToken = await checkin.rpc("checkin_find_by_token", {
      p_event_id: EVENTS.wedding,
      p_token: guest.invite_token,
    });
    expect(byToken.data).toBe(guest.id);

    const first = await checkin.rpc("check_in_guest", {
      p_event_id: EVENTS.wedding,
      p_guest_id: guest.id,
      p_arrived_count: 3,
    });
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ status: "checked_in", arrived_count: 3 });

    const second = await checkin.rpc("check_in_guest", {
      p_event_id: EVENTS.wedding,
      p_guest_id: guest.id,
      p_arrived_count: 3,
    });
    expect(second.data).toMatchObject({ status: "already_checked_in", arrived_count: 3 });

    const undoByCheckin = await checkin.rpc("undo_check_in", {
      p_event_id: EVENTS.wedding,
      p_guest_id: guest.id,
    });
    expect(undoByCheckin.error?.code).toBe("42501");

    const undo = await manager.rpc("undo_check_in", { p_event_id: EVENTS.wedding, p_guest_id: guest.id });
    expect(undo.error).toBeNull();
    const { data: row } = await manager.from("guests").select("checked_in_at").eq("id", guest.id).single();
    expect(row!.checked_in_at).toBeNull();
  });

  it("cannot check in at another event", async () => {
    const { error } = await checkin.rpc("checkin_search", { p_event_id: EVENTS.barMitzvah });
    expect(error?.code).toBe("42501");
  });
});

describe("outsider (another customer)", () => {
  it("sees only their own event and none of the manager's data", async () => {
    const { data: events } = await outsider.from("events").select("id");
    expect(events!.map((e) => e.id)).toEqual([EVENTS.conference]);

    const { data: guests } = await outsider.from("guests").select("id").eq("event_id", EVENTS.wedding);
    expect(guests).toEqual([]);

    const { data: profiles } = await outsider.from("profiles").select("id");
    expect(profiles!.map((p) => p.id)).toEqual([USERS.outsider.id]);

    const stats = await outsider.rpc("event_stats", { p_event_id: EVENTS.wedding });
    expect(stats.error?.code).toBe("42501");
  });

  it("cannot make themselves a platform admin", async () => {
    const direct = await outsider
      .from("profiles")
      .update({ is_platform_admin: true })
      .eq("id", USERS.outsider.id);
    expect(direct.error?.code).toBe("42501");

    const rpc = await outsider.rpc("set_platform_admin", { p_user_id: USERS.outsider.id, p_is_admin: true });
    expect(rpc.error?.code).toBe("42501");
  });

  it("can edit their own name", async () => {
    const { error } = await outsider
      .from("profiles")
      .update({ full_name: "משתמש חיצוני" })
      .eq("id", USERS.outsider.id);
    expect(error).toBeNull();
  });
});

describe("platform admin", () => {
  it("sees every event", async () => {
    const { data } = await admin.from("events").select("id");
    const ids = data!.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(Object.values(EVENTS)));
  });

  it("sees teammates' profiles as a viewer would not", async () => {
    const { data } = await viewer.from("profiles").select("id");
    // viewer shares the wedding with manager and checkin
    expect(data!.map((p) => p.id).sort()).toEqual(
      [USERS.viewer.id, USERS.manager.id, USERS.checkin.id].sort(),
    );
  });
});
