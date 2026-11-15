import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";
import { EVENTS, password, storageState } from "./fixtures";

const REPORTS = `/events/${EVENTS.wedding}/reports`;
const TITLES = {
  seating: "אורחים לפי שולחן",
  catering: "רגישויות מזון לקייטרינג",
  rsvp: "מעקב אישורי הגעה",
  attendance: "נוכחות בפועל",
} as const;

let manager: SupabaseClient;
test.beforeAll(async () => {
  manager = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  await manager.auth.signInWithPassword({ email: "manager@example.com", password: password() });
});

const summaryValue = (page: Page, label: string) =>
  page.locator("dl > div").filter({ has: page.locator("dt", { hasText: new RegExp(`^${label.replace(/[()]/g, "\\$&")}$`) }) }).locator("dd");

test.use({ storageState: storageState("manager") });

test("hub lists the four reports and the module exports", async ({ page }) => {
  await page.goto(REPORTS);
  await expect(page.getByRole("heading", { name: "דוחות", level: 1 })).toBeVisible();
  for (const [key, title] of Object.entries(TITLES)) {
    await expect(page.getByRole("link", { name: new RegExp(title) })).toHaveAttribute("href", `${REPORTS}/${key}`);
  }
  await expect(page.getByRole("link", { name: /רשימת מוזמנים מלאה/ })).toHaveAttribute("href", `/events/${EVENTS.wedding}/guests`);
  await expect(page.getByRole("link", { name: /^מתנות כפתור/ })).toHaveAttribute("href", `/events/${EVENTS.wedding}/gifts`);
  await expect(page.getByRole("link", { name: /תקציב והוצאות/ })).toHaveAttribute("href", `/events/${EVENTS.wedding}/budget`);

  await page.getByRole("link", { name: new RegExp(TITLES.catering) }).click();
  await expect(page).toHaveURL(`${REPORTS}/catering`);
  await expect(page.getByRole("heading", { name: TITLES.catering, level: 1 })).toBeVisible();
});

test("every report renders its title, summary and sections", async ({ page }) => {
  for (const [key, title] of Object.entries(TITLES)) {
    await page.goto(`${REPORTS}/${key}`);
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await expect(page.locator("dl > div")).toHaveCount(4);
    expect(await page.locator("section[data-print=section]").count()).toBeGreaterThan(0);
  }
});

test("catering meal count matches the database", async ({ page }) => {
  const { data } = await manager
    .from("guests")
    .select("confirmed_adults, confirmed_children")
    .eq("event_id", EVENTS.wedding)
    .eq("rsvp_status", "attending");
  const adults = (data ?? []).reduce((s, g) => s + g.confirmed_adults, 0);
  const children = (data ?? []).reduce((s, g) => s + g.confirmed_children, 0);

  await page.goto(`${REPORTS}/catering`);
  await expect(summaryValue(page, "מנות (אישרו הגעה)")).toHaveText(String(adults + children));
  await expect(summaryValue(page, "מבוגרים")).toHaveText(String(adults));
  await expect(summaryValue(page, "ילדים")).toHaveText(String(children));
});

test("rsvp report lists exactly the guests who have not answered", async ({ page }) => {
  const { count } = await manager
    .from("guests")
    .select("id", { count: "exact", head: true })
    .eq("event_id", EVENTS.wedding)
    .in("rsvp_status", ["pending", "maybe"]);
  await page.goto(`${REPORTS}/rsvp`);
  await expect(summaryValue(page, "ממתינים לתשובה (הזמנות)")).toHaveText(String(count));
  await expect(page.getByRole("region", { name: /לא ענו עדיין/ }).locator("tbody tr")).toHaveCount(count!);
});

test("excel export has a summary sheet and one sheet per section", async ({ page }) => {
  await page.goto(`${REPORTS}/seating`);
  const sections = await page.locator("section[data-print=section] h2").count();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "ייצוא ל-Excel" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(await download.path());
  expect(wb.worksheets.map((w) => w.name)).toEqual(expect.arrayContaining(["סיכום", "שיבוץ לפי שולחן"]));
  expect(wb.worksheets).toHaveLength(sections + 1);
  const summary = wb.getWorksheet("סיכום")!;
  expect(summary.getRow(2).getCell(1).value).toBe("שולחנות");
  expect(summary.getRow(2).getCell(2).value).toBe(15);
});

test("print layout hides navigation and the toolbar", async ({ page }) => {
  await page.goto(`${REPORTS}/seating`);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("heading", { name: TITLES.seating, level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "הדפסה" })).toBeHidden();
  await expect(page.getByRole("button", { name: "ייצוא ל-Excel" })).toBeHidden();
  await expect(page.locator("[data-slot=sidebar-gap]")).toBeHidden();
  await expect(page.getByRole("link", { name: "כל הדוחות" })).toBeHidden();
});

test("an unknown report is a 404", async ({ page }) => {
  const res = await page.goto(`${REPORTS}/nope`);
  expect(res?.status()).toBe(404);
});

test.describe("viewer", () => {
  test.use({ storageState: storageState("viewer") });
  test("can read reports", async ({ page }) => {
    await page.goto(`${REPORTS}/rsvp`);
    await expect(page.getByRole("heading", { name: TITLES.rsvp, level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "ייצוא ל-Excel" })).toBeVisible();
  });
});

test.describe("check-in staff", () => {
  test.use({ storageState: storageState("checkin") });
  test("are sent to check-in", async ({ page }) => {
    await page.goto(`${REPORTS}/seating`);
    await expect(page).toHaveURL(`/events/${EVENTS.wedding}/checkin`);
  });
});
