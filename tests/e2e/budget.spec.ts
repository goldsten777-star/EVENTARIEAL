import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";
import { EVENTS, password, storageState } from "./fixtures";

const BUDGET = `/events/${EVENTS.wedding}/budget`;
const TAG = "E2E ספק";

let manager: SupabaseClient;
let originalBudget = 0;
test.beforeAll(async () => {
  manager = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  await manager.auth.signInWithPassword({ email: "manager@example.com", password: password() });
  const { data } = await manager.from("events").select("budget_total").eq("id", EVENTS.wedding).single();
  originalBudget = Number(data!.budget_total);
});
test.afterAll(async () => {
  await manager.from("expenses").delete().eq("event_id", EVENTS.wedding).like("vendor_name", `${TAG}%`);
  await manager.from("events").update({ budget_total: originalBudget }).eq("id", EVENTS.wedding);
});

const ils = (v: number) => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(v);
const tile = (page: Page, name: string) => page.getByRole("group", { name, exact: true }).locator("[data-slot=stat-value]");
const dialog = (page: Page) => page.getByRole("dialog");

async function dbActual() {
  const { data } = await manager.from("expenses").select("actual_amount").eq("event_id", EVENTS.wedding);
  return (data ?? []).reduce((s, e) => s + Number(e.actual_amount), 0);
}

test.use({ storageState: storageState("manager") });

test("add, pay and delete an expense; totals follow the database", async ({ page }) => {
  const vendor = `${TAG} ${Date.now()}`;
  const start = await dbActual();
  await page.goto(BUDGET);
  await expect(tile(page, "הוצאות בפועל")).toHaveText(ils(start));

  await page.getByRole("button", { name: "הוצאה חדשה" }).click();
  await dialog(page).getByLabel("שולם (₪)").fill("500");
  await dialog(page).getByRole("button", { name: "הוספת ההוצאה" }).click();
  await expect(dialog(page).getByText("יש להזין ספק או תיאור")).toBeVisible();
  await expect(dialog(page).getByText("הסכום ששולם גבוה מעלות ההוצאה")).toBeVisible();

  await dialog(page).getByRole("combobox", { name: "קטגוריה" }).click();
  await page.getByRole("option", { name: "מוזיקה" }).click();
  await dialog(page).getByLabel("ספק").fill(vendor);
  await dialog(page).getByLabel("מתוכנן (₪)").fill("4,000");
  await dialog(page).getByLabel("בפועל (₪)").fill("3500");
  await dialog(page).getByLabel("שולם (₪)").fill("1000");
  await dialog(page).getByLabel("מועד תשלום").fill("2027-03-01");
  await dialog(page).getByRole("button", { name: "הוספת ההוצאה" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByText("ההוצאה נוספה")).toBeVisible();
  await expect(tile(page, "הוצאות בפועל")).toHaveText(ils(start + 3500));

  const row = page.locator("tbody tr").filter({ hasText: vendor });
  await expect(row).toContainText("שולם חלקית");
  await expect(row).toContainText(`${ils(2500)} עד`);

  await row.getByRole("button", { name: `עריכת ההוצאה ${vendor}` }).click();
  await dialog(page).getByLabel("שולם (₪)").fill("3500");
  await dialog(page).getByRole("button", { name: "שמירת השינויים" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(row).toContainText("שולם");
  await expect(row).not.toContainText("שולם חלקית");

  // status filter
  await page.getByRole("combobox", { name: "סטטוס תשלום" }).click();
  await page.getByRole("option", { name: "שולם", exact: true }).click();
  await expect(row).toBeVisible();
  await page.getByRole("combobox", { name: "סטטוס תשלום" }).click();
  await page.getByRole("option", { name: "לא שולם" }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole("combobox", { name: "סטטוס תשלום" }).click();
  await page.getByRole("option", { name: "כל הסטטוסים" }).click();

  // export includes the line and a totals row
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "ייצוא" }).click();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(await (await downloadPromise).path());
  const ws = wb.worksheets[0];
  const vendors = ws.getColumn(2).values as unknown[];
  expect(vendors).toContain(vendor);
  expect(ws.getRow(ws.rowCount).getCell(1).value).toBe("סה״כ");

  await row.getByRole("button", { name: `מחיקת ההוצאה ${vendor}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "מחיקה" }).click();
  await expect(page.getByText("ההוצאה נמחקה")).toBeVisible();
  await expect(row).toHaveCount(0);
  await expect(tile(page, "הוצאות בפועל")).toHaveText(ils(start));
});

test("the total budget can be updated", async ({ page }) => {
  await page.goto(BUDGET);
  await page.getByRole("button", { name: "עדכון התקציב" }).click();
  await dialog(page).getByLabel("תקציב כולל (₪)").fill("abc");
  await dialog(page).getByRole("button", { name: "שמירה" }).click();
  await expect(dialog(page).getByText("תקציב: יש להזין סכום חיובי")).toBeVisible();
  await dialog(page).getByLabel("תקציב כולל (₪)").fill("200,000");
  await dialog(page).getByRole("button", { name: "שמירה" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(tile(page, "תקציב כולל")).toHaveText(ils(200000));
});

test.describe("viewer", () => {
  test.use({ storageState: storageState("viewer") });

  test("sees the budget but cannot change it", async ({ page }) => {
    await page.goto(BUDGET);
    await expect(tile(page, "הוצאות בפועל")).toBeVisible();
    await expect(page.getByRole("button", { name: "הוצאה חדשה" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "עדכון התקציב" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^עריכת ההוצאה/ })).toHaveCount(0);
  });
});
