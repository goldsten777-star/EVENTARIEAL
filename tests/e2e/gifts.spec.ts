import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";
import { EVENTS, password, storageState } from "./fixtures";

const GIFTS = `/events/${EVENTS.wedding}/gifts`;
const TAG = "E2E gift";

let manager: SupabaseClient;
test.beforeAll(async () => {
  manager = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  await manager.auth.signInWithPassword({ email: "manager@example.com", password: password() });
});
test.afterAll(async () => {
  await manager.from("gifts").delete().eq("event_id", EVENTS.wedding).like("notes", `${TAG}%`);
});

const ils = (v: number) => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(v);
const totalTile = (page: Page) => page.getByRole("group", { name: "סך המתנות", exact: true }).locator("[data-slot=stat-value]");
const dialog = (page: Page) => page.getByRole("dialog");

async function dbTotal() {
  const { data } = await manager.from("gifts").select("amount").eq("event_id", EVENTS.wedding);
  return (data ?? []).reduce((s, g) => s + Number(g.amount), 0);
}

test.use({ storageState: storageState("manager") });

test("record, edit and delete a gift; totals follow the database", async ({ page }) => {
  const note = `${TAG} ${Date.now()}`;
  const start = await dbTotal();
  await page.goto(GIFTS);
  await expect(totalTile(page)).toHaveText(ils(start));

  await page.getByRole("button", { name: "מתנה חדשה" }).click();
  await dialog(page).getByRole("button", { name: "רישום המתנה" }).click();
  await expect(dialog(page).getByText("יש להזין סכום")).toBeVisible();

  // pick a guest by phone search
  await dialog(page).getByRole("combobox", { name: "אורח" }).click();
  await page.getByPlaceholder("חיפוש לפי שם או טלפון…").fill("0511000037");
  await page.getByRole("option", { name: /מיכל אזולאי/ }).click();
  await expect(dialog(page).getByRole("combobox", { name: "אורח" })).toHaveText(/מיכל אזולאי/);

  await dialog(page).getByLabel("סכום (₪)").fill("1,200");
  await dialog(page).getByRole("combobox", { name: "אמצעי תשלום" }).click();
  await page.getByRole("option", { name: "העברה בנקאית" }).click();
  await dialog(page).getByLabel("הערות").fill(note);
  await dialog(page).getByRole("button", { name: "רישום המתנה" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByText("המתנה נרשמה")).toBeVisible();
  await expect(totalTile(page)).toHaveText(ils(start + 1200));

  await page.getByPlaceholder("חיפוש לפי אורח, טלפון או הערה…").fill(note);
  const row = page.locator("tbody tr");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("מיכל אזולאי");
  await expect(row).toContainText(ils(1200));
  await expect(row).toContainText("העברה בנקאית");

  await row.getByRole("button", { name: "עריכת המתנה של מיכל אזולאי" }).click();
  await dialog(page).getByLabel("סכום (₪)").fill("1500");
  await dialog(page).getByRole("button", { name: "שמירת השינויים" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(row).toContainText(ils(1500));
  await expect(totalTile(page)).toHaveText(ils(start + 1500));

  // export what is shown
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "ייצוא" }).click();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(await (await downloadPromise).path());
  const ws = wb.worksheets[0];
  expect(ws.getRow(2).getCell(1).value).toBe("מיכל אזולאי");
  expect(ws.getRow(2).getCell(3).value).toBe(1500);
  expect(ws.getRow(3).getCell(1).value).toBe("סה״כ");

  await row.getByRole("button", { name: "מחיקת המתנה של מיכל אזולאי" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "מחיקה" }).click();
  await expect(page.getByText("המתנה נמחקה")).toBeVisible();
  await expect(row).toHaveCount(0);
  await expect(totalTile(page)).toHaveText(ils(start));
});

test.describe("viewer", () => {
  test.use({ storageState: storageState("viewer") });

  test("sees gifts but cannot change them", async ({ page }) => {
    await page.goto(GIFTS);
    await expect(totalTile(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "מתנה חדשה" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^עריכת המתנה/ })).toHaveCount(0);
  });
});
