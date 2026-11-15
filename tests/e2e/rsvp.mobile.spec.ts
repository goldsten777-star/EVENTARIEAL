import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { EVENTS, password } from "./fixtures";

let manager: SupabaseClient;
let guest: { id: string; invite_token: string };

test.beforeAll(async () => {
  manager = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  await manager.auth.signInWithPassword({ email: "manager@example.com", password: password() });
  const { data, error } = await manager
    .from("guests")
    .insert({
      event_id: EVENTS.wedding,
      first_name: "משפחת",
      last_name: `E2E RSVP ${Date.now()}`,
      invited_adults: 2,
      invited_children: 1,
    })
    .select("id, invite_token")
    .single();
  if (error) throw error;
  guest = data;
});

test.afterAll(async () => {
  await manager.from("guests").delete().eq("id", guest.id);
});

const row = async () =>
  (await manager.from("guests").select("rsvp_status, confirmed_adults, confirmed_children, rsvp_note, invitation_status").eq("id", guest.id).single()).data!;

test("a guest confirms on a phone, is held to the reserved seats, then declines", async ({ page }) => {
  await page.goto(`/r/${guest.invite_token}`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("נועה ואיתי");
  await expect(page.getByText(/שלום משפחת E2E RSVP/)).toBeVisible();
  await expect(page.getByText("3 מקומות")).toBeVisible();
  expect((await row()).invitation_status).toBe("viewed");

  await page.getByRole("radio", { name: "מגיעים" }).click();
  await expect(page.getByRole("status", { name: "מבוגרים" })).toHaveText("2");
  await expect(page.getByRole("status", { name: "ילדים" })).toHaveText("1");

  await page.getByRole("button", { name: "הוספת ילדים" }).click();
  await expect(page.getByText("שמרנו עבורכם 3 מקומות בלבד")).toBeVisible();
  await expect(page.getByRole("button", { name: "שליחת תשובה" })).toBeDisabled();
  await page.getByRole("button", { name: "הפחתת ילדים" }).click();
  await page.getByRole("button", { name: "הפחתת ילדים" }).click();
  await page.getByLabel("הערות (רגישויות, בקשות מיוחדות)").fill("מנה צמחונית");
  await page.getByRole("button", { name: "שליחת תשובה" }).click();

  await expect(page.getByRole("heading", { name: "תודה! נתראה בשמחה" })).toBeVisible();
  await expect(page.getByText("אישרתם הגעה של 2 מבוגרים.")).toBeVisible();
  expect(await row()).toMatchObject({ rsvp_status: "attending", confirmed_adults: 2, confirmed_children: 0, rsvp_note: "מנה צמחונית" });

  // coming back shows the saved answer; it can still be changed
  await page.reload();
  await expect(page.getByRole("heading", { name: "תודה! נתראה בשמחה" })).toBeVisible();
  await page.getByRole("button", { name: "עדכון התשובה" }).click();
  await page.getByRole("radio", { name: "לא נוכל להגיע" }).click();
  await page.getByRole("button", { name: "שליחת תשובה" }).click();
  await expect(page.getByRole("heading", { name: "תודה על העדכון" })).toBeVisible();
  expect(await row()).toMatchObject({ rsvp_status: "declined", confirmed_adults: 0 });

  const overflow = await page.evaluate(() => window.innerWidth);
  expect(overflow).toBe(page.viewportSize()!.width);
});

test("an unknown link shows a friendly 404", async ({ page }) => {
  const res = await page.goto("/r/this-token-does-not-exist-0000");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "הקישור אינו תקף" })).toBeVisible();
});
