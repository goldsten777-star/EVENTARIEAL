import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { EVENTS, password, storageState } from "./fixtures";

const DASHBOARD = `/events/${EVENTS.wedding}/dashboard`;

let manager: SupabaseClient;
test.beforeAll(async () => {
  manager = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  await manager.auth.signInWithPassword({ email: "manager@example.com", password: password() });
});

test.afterAll(async () => {
  await manager.from("guests").delete().eq("event_id", EVENTS.wedding).like("last_name", "E2E DASH%");
});

const tile = (page: Page, label: string) => page.getByRole("group", { name: label, exact: true });
const tileValue = (page: Page, label: string) => tile(page, label).locator("[data-slot=stat-value]");
const n = (value: number) => new Intl.NumberFormat("he-IL").format(value);

test.use({ storageState: storageState("manager") });

test("headline numbers match the database", async ({ page }) => {
  const { data } = await manager.rpc("event_stats", { p_event_id: EVENTS.wedding });
  const t = (data as { totals: Record<string, number> }).totals;

  await page.goto(DASHBOARD);
  await expect(page.getByRole("heading", { level: 1, name: "לוח בקרה" })).toBeVisible();
  await expect(tileValue(page, "סך המוזמנים")).toHaveText(n(t.people_invited));
  await expect(tileValue(page, "אישרו הגעה")).toHaveText(n(t.attending_people));
  await expect(tileValue(page, "ממתינים לתשובה")).toHaveText(n(t.pending_people));
  await expect(tileValue(page, "לא מגיעים")).toHaveText(n(t.declined_people));
  await expect(page.getByText("סטטוס אישורי הגעה", { exact: true })).toBeVisible();
  await expect(page.getByRole("table", { name: "תשובות מצטברות לפי יום" })).toBeAttached();
});

test("a guest's answer appears on the open dashboard without reloading", async ({ page }) => {
  await page.goto(DASHBOARD);
  await expect(page.locator("[data-realtime=live]")).toBeAttached({ timeout: 15_000 });
  const before = await tileValue(page, "אישרו הגעה").textContent();
  const start = Number((before ?? "0").replace(/\D/g, ""));

  const { data: guest, error } = await manager
    .from("guests")
    .insert({ event_id: EVENTS.wedding, first_name: "בדיקה", last_name: `E2E DASH ${Date.now()}`, invited_adults: 2 })
    .select("invite_token")
    .single();
  expect(error).toBeNull();

  // the guest answers from their own phone (anonymous)
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  const rsvp = await anon.rpc("submit_rsvp", { p_token: guest!.invite_token, p_status: "attending", p_adults: 2, p_children: 0 });
  expect(rsvp.error).toBeNull();

  await expect(tileValue(page, "אישרו הגעה")).toHaveText(n(start + 2), { timeout: 20_000 });
  await expect(page.getByText(/אישרו הגעה דרך הקישור · 2 משתתפים/).first()).toBeVisible();
});

test.describe("viewer", () => {
  test.use({ storageState: storageState("viewer") });

  test("sees the dashboard without manager actions", async ({ page }) => {
    await page.goto(DASHBOARD);
    await expect(tileValue(page, "סך המוזמנים")).toBeVisible();
    await expect(page.getByRole("link", { name: "לרשימת המוזמנים" })).toHaveCount(0);
  });
});
