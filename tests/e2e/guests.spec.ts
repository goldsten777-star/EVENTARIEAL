import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";
import { EVENTS, password, storageState } from "./fixtures";

const GUESTS = `/events/${EVENTS.wedding}/guests`;
const TAG = "E2E";

test.use({ storageState: storageState("manager") });

// safety net: remove anything a failed run left behind
test.afterAll(async () => {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  await supabase.auth.signInWithPassword({ email: "manager@example.com", password: password() });
  await supabase.from("guests").delete().eq("event_id", EVENTS.wedding).like("last_name", `${TAG}%`);
  await supabase.from("guest_groups").delete().eq("event_id", EVENTS.wedding).like("name", `${TAG}%`);
});

const sheet = (page: Page) => page.getByRole("dialog");
const rows = (page: Page) => page.locator("tbody tr");

async function search(page: Page, text: string) {
  await page.getByPlaceholder("חיפוש לפי שם, טלפון, מזמין או אימייל…").fill(text);
}

async function chooseOption(page: Page, name: string, option: string) {
  await sheet(page).getByRole("combobox", { name }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("add, edit and delete a family with validation and duplicate detection", async ({ page }) => {
  const last = `${TAG} ${Date.now()}`;
  await page.goto(GUESTS);
  await page.getByRole("button", { name: "הוספת מוזמן / משפחה" }).click();

  // validation happens before anything is sent
  await sheet(page).getByLabel("טלפון נייד").fill("12");
  await sheet(page).getByRole("button", { name: "הוספה", exact: true }).click();
  await expect(sheet(page).getByText("יש להזין שם פרטי (או 'משפחת')")).toBeVisible();
  await expect(sheet(page).getByText("מספר טלפון לא תקין")).toBeVisible();

  // live duplicate warning (seeded guest מיכל אזולאי owns this number)
  await sheet(page).getByLabel("טלפון נייד").fill("051-100-0037");
  await expect(sheet(page).getByRole("alert").filter({ hasText: "המספר כבר שייך למיכל אזולאי" })).toBeVisible();

  // the server refuses the duplicate as well
  await sheet(page).getByLabel("שם פרטי").fill("משפחת");
  await sheet(page).getByLabel("שם משפחה").fill(last);
  await sheet(page).getByRole("button", { name: "הוספה", exact: true }).click();
  await expect(sheet(page).getByText(/כבר שייך למיכל אזולאי/).last()).toBeVisible();

  await sheet(page).getByLabel("טלפון נייד").fill("058-999-0001");
  await sheet(page).getByRole("button", { name: "משפחה", exact: true }).click();
  await expect(sheet(page).getByLabel("מבוגרים")).toHaveValue("2");
  await expect(sheet(page).getByLabel("ילדים")).toHaveValue("2");
  await sheet(page).getByLabel("ילדים").fill("3");
  await chooseOption(page, "קבוצה", "חברים");
  await sheet(page).getByRole("button", { name: "צמחוני" }).click();
  await sheet(page).getByRole("button", { name: "הוספה", exact: true }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(page.getByText(`משפחת ${last} נוספ/ה לרשימה`)).toBeVisible();

  await search(page, last);
  await expect(rows(page)).toHaveCount(1);
  const row = rows(page).first();
  await expect(row).toContainText("058-999-0001");
  await expect(row).toContainText("2 מב׳ · 3 יל׳");
  await expect(row).toContainText("חברים");
  await expect(row).toContainText("צמחוני");
  await expect(row).toContainText("ממתין");

  // edit: phone RSVP for 4 out of 5
  await row.getByRole("button", { name: `עריכת משפחת ${last}` }).click();
  await chooseOption(page, "סטטוס", "מגיעים");
  await sheet(page).getByLabel("מבוגרים שאישרו").fill("2");
  await sheet(page).getByLabel("ילדים שאישרו").fill("4");
  await sheet(page).getByRole("button", { name: "שמירת השינויים" }).click();
  await expect(sheet(page).getByText(/אישרו 6 אבל נשמרו רק 5 מקומות/)).toBeVisible();
  await sheet(page).getByLabel("ילדים שאישרו").fill("2");
  await sheet(page).getByRole("button", { name: "שמירת השינויים" }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(rows(page).first()).toContainText("מגיעים · 4");

  // delete
  await rows(page).first().getByRole("button", { name: `עריכת משפחת ${last}` }).click();
  await sheet(page).getByRole("button", { name: "מחיקה" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "מחיקה" }).click();
  await expect(page.getByText("1 הזמנות נמחקו")).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByText("אין תוצאות")).toBeVisible();
});

test("search by local phone, filter, and sort", async ({ page }) => {
  await page.goto(GUESTS);
  await search(page, "0511000037");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("מיכל אזולאי");

  await search(page, "");
  await page.getByRole("combobox", { name: "אישור הגעה" }).click();
  await page.getByRole("option", { name: "לא מגיעים" }).click();
  const count = await rows(page).count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) await expect(rows(page).nth(i)).toContainText("לא מגיעים");
  await page.getByRole("button", { name: /ניקוי/ }).click();
  await expect(page.getByText(/מציג 1–50 מתוך 1\d\d/)).toBeVisible();

  const nameHeader = page.getByRole("columnheader", { name: "שם" });
  await nameHeader.getByRole("button").click();
  await expect(nameHeader).toHaveAttribute("aria-sort", /ascending|descending/);
});

test("bulk actions and Excel round trip (import, export)", async ({ page }) => {
  const stamp = Date.now();
  await page.goto(GUESTS);

  // --- import ---
  const csv = [
    "שם פרטי,שם משפחה,נייד,קבוצה,מבוגרים,ילדים,סטטוס",
    `משפחת,${TAG} א ${stamp},0587770001,${TAG} שכנים,2,1,מגיעים`,
    `דני,${TAG} ב ${stamp},0587770002,,1,,`,
    `שגוי,${TAG} ג ${stamp},abc,,1,,`,
    `כפול,${TAG} ד ${stamp},058-777-0001,,1,,`,
    `מיכל,${TAG} קיימת ${stamp},0511000037,,1,,`,
  ].join("\n");
  await page.getByRole("button", { name: "ייבוא מ-Excel" }).click();
  await page.getByLabel("בחירת קובץ לייבוא").setInputFiles({ name: "guests.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByRole("dialog")).toContainText("5 שורות");
  await page.getByRole("button", { name: "המשך לבדיקה" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("group", { name: "שורות תקינות" })).toContainText("4");
  await expect(dialog.getByRole("group", { name: "שורות עם שגיאות" })).toContainText("1");
  await expect(dialog.getByRole("group", { name: "קיימים כבר באירוע" })).toContainText("1");
  await expect(dialog.getByRole("group", { name: "כפולים בקובץ" })).toContainText("1");
  await dialog.getByRole("button", { name: "ייבוא 4 שורות" }).click();
  await expect(dialog.getByRole("group", { name: "נוספו" })).toContainText("2", { timeout: 20_000 });
  await expect(dialog.getByRole("group", { name: "דולגו (כפולים)" })).toContainText("2");
  await expect(dialog.getByText(/שורה 4: מספר טלפון לא תקין/)).toBeVisible();
  await dialog.getByRole("button", { name: "סיום" }).click();

  await search(page, String(stamp));
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).filter({ hasText: `${TAG} א ${stamp}` })).toContainText(`${TAG} שכנים`);
  await expect(rows(page).filter({ hasText: `${TAG} א ${stamp}` })).toContainText("מגיעים · 3");

  // --- export the filtered list ---
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /^ייצוא/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^חתונת נועה ואיתי - מוזמנים \d{4}-\d{2}-\d{2}\.xlsx$/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(await download.path());
  const ws = wb.worksheets[0];
  expect(ws.views[0].rightToLeft).toBe(true);
  expect(ws.rowCount).toBe(3);
  expect(ws.getRow(1).getCell(1).value).toBe("שם פרטי");
  const phones = [ws.getRow(2).getCell(3).value, ws.getRow(3).getCell(3).value].sort();
  expect(phones).toEqual(["058-777-0001", "058-777-0002"]);

  // --- bulk actions on the two imported rows ---
  await page.getByRole("checkbox", { name: "בחירת כל השורות בעמוד" }).click();
  await expect(page.getByText("2 נבחרו")).toBeVisible();
  await page.getByRole("button", { name: "שיוך לקבוצה" }).click();
  await page.getByRole("menuitem", { name: "עבודה" }).click();
  await expect(page.getByText("2 הזמנות עודכנו")).toBeVisible();
  for (const r of await rows(page).all()) await expect(r).toContainText("עבודה");

  await page.getByRole("button", { name: "סימון הזמנה" }).click();
  await page.getByRole("menuitem", { name: "נשלחה", exact: true }).click();
  await expect(page.getByText("2 הזמנות עודכנו")).toBeVisible();

  await page.getByRole("region", { name: "פעולות על הנבחרים" }).getByRole("button", { name: "מחיקה" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "מחיקה" }).click();
  await expect(page.getByText("2 הזמנות נמחקו")).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
});

test("the import template downloads", async ({ page }) => {
  await page.goto(GUESTS);
  await page.getByRole("button", { name: "ייבוא מ-Excel" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "הורדת תבנית לדוגמה" }).click();
  const download = await downloadPromise;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(await download.path());
  expect(wb.worksheets.map((w) => w.name)).toEqual(["מוזמנים", "הסבר"]);
});

test.describe("viewer", () => {
  test.use({ storageState: storageState("viewer") });

  test("can browse and export but not change anything", async ({ page }) => {
    await page.goto(GUESTS);
    await expect(page.getByRole("button", { name: /^ייצוא/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "הוספת מוזמן / משפחה" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ייבוא מ-Excel" })).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);

    await rows(page).first().getByRole("button", { name: /^פרטי / }).click();
    await expect(sheet(page).getByLabel("שם פרטי")).toBeDisabled();
    await expect(sheet(page).getByRole("button", { name: /שמירה|שמירת השינויים/ })).toHaveCount(0);
  });
});

test("each guest has a personal link, WhatsApp message and QR", async ({ page }) => {
  await page.goto(GUESTS);
  await search(page, "0511000037");
  const row = rows(page).first();

  const wa = row.getByRole("link", { name: "שליחת הזמנה ב-WhatsApp למיכל אזולאי" });
  const href = (await wa.getAttribute("href"))!;
  expect(href).toMatch(/^https:\/\/wa\.me\/972511000037\?text=/);
  const text = decodeURIComponent(href.split("?text=")[1]);
  expect(text).toContain("שלום מיכל אזולאי");
  expect(text).toMatch(/\/r\/[A-Za-z0-9_-]{24}/);

  await row.getByRole("button", { name: "עריכת מיכל אזולאי" }).click();
  const link = await sheet(page).getByLabel("קישור אישי לאישור הגעה").inputValue();
  expect(text).toContain(link);
  await expect(sheet(page).getByRole("img", { name: "קוד QR לאישור ההגעה של מיכל אזולאי" })).toBeVisible();
  await expect(sheet(page).getByRole("link", { name: "שליחה ב-WhatsApp" })).toHaveAttribute("href", href);

  // the link opens the guest's RSVP page
  await page.goto(new URL(link).pathname);
  await expect(page.getByText("שלום מיכל אזולאי,")).toBeVisible();
});
