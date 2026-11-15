import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { password, storageState } from "./fixtures";

const PREFIX = "E2E אירוע";

test.use({ storageState: storageState("manager") });

// safety net: remove events left behind by a failed run
test.afterAll(async () => {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  await supabase.auth.signInWithPassword({ email: "manager@example.com", password: password() });
  await supabase.from("events").delete().like("name", `${PREFIX}%`);
});

const formAlert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

async function chooseOption(page: Page, trigger: ReturnType<Page["getByRole"]>, option: string) {
  await trigger.click();
  await page.getByRole("option", { name: option }).click();
}

test("create-event form validates before creating anything", async ({ page }) => {
  await page.goto("/events");
  await page.getByRole("button", { name: "אירוע חדש" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "יצירת האירוע" }).click();
  await expect(dialog.getByText("יש להזין שם לאירוע (לפחות 2 תווים)")).toBeVisible();

  await dialog.getByLabel("שם האירוע").fill(`${PREFIX} ולידציה`);
  await dialog.getByLabel("תאריך ושעה").fill("2027-06-01T19:00");
  await dialog.getByLabel("מועד אחרון לאישור הגעה").fill("2027-06-02T10:00");
  await dialog.getByLabel("תקציב כולל (₪)").fill("-50");
  await dialog.getByRole("button", { name: "יצירת האירוע" }).click();
  await expect(dialog.getByText("המועד האחרון לאישור הגעה חייב להיות לפני האירוע")).toBeVisible();
  await expect(dialog.getByText("יש להזין סכום חיובי")).toBeVisible();
  await expect(page).toHaveURL(/\/events$/);
});

test("full event lifecycle: create, edit, groups, team, delete", async ({ page }) => {
  const name = `${PREFIX} ${Date.now()}`;

  // --- create ---
  await page.goto("/events");
  await page.getByRole("button", { name: "אירוע חדש" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("שם האירוע").fill(name);
  await chooseOption(page, dialog.getByRole("combobox", { name: "סוג האירוע" }), "בר מצווה");
  await dialog.getByLabel("תאריך ושעה").fill("2027-06-01T19:00");
  await dialog.getByLabel("שם המקום").fill("אולם הבדיקות");
  await dialog.getByLabel("תקציב כולל (₪)").fill("50,000");
  await dialog.getByRole("button", { name: "יצירת האירוע" }).click();

  await expect(page).toHaveURL(/\/events\/[0-9a-f-]+\/settings\?created=1$/);
  await expect(page.getByRole("status").filter({ hasText: "האירוע נוצר" })).toBeVisible();
  await expect(page.locator("header").getByText(name)).toBeVisible();
  await expect(page.getByLabel("תאריך ושעה")).toHaveValue("2027-06-01T19:00");
  await expect(page.getByLabel("תקציב כולל (₪)")).toHaveValue("50000");
  await expect(page.getByRole("combobox", { name: "סוג האירוע" })).toHaveText("בר מצווה");

  // --- edit details ---
  const renamed = `${name} (עודכן)`;
  await page.getByLabel("שם האירוע").fill(renamed);
  await page.getByLabel("שמות המארחים").fill("משפחת בדיקה");
  await page.getByLabel("נוסח הודעת ההזמנה").fill("שלום {שם}, לאישור: {קישור}");
  await page.getByRole("button", { name: "שמירת השינויים" }).click();
  await expect(page.getByText("פרטי האירוע נשמרו")).toBeVisible();
  await expect(page.locator("header").getByText(renamed)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("שמות המארחים")).toHaveValue("משפחת בדיקה");

  // --- groups ---
  await page.getByRole("tab", { name: "קבוצות" }).click();
  for (const g of ["משפחה", "חברים", "עבודה", "אחרים"]) {
    await expect(page.getByRole("tabpanel").getByRole("listitem").filter({ hasText: g })).toBeVisible();
  }
  await page.getByRole("button", { name: "קבוצה חדשה" }).click();
  await page.getByRole("dialog").getByLabel("שם הקבוצה").fill("שכנים");
  await page.getByRole("dialog").getByRole("button", { name: "הוספת קבוצה" }).click();
  await expect(page.getByRole("tabpanel").getByRole("listitem").filter({ hasText: "שכנים" })).toBeVisible();

  await page.getByRole("button", { name: "קבוצה חדשה" }).click();
  await page.getByRole("dialog").getByLabel("שם הקבוצה").fill("שכנים");
  await page.getByRole("dialog").getByRole("button", { name: "הוספת קבוצה" }).click();
  await expect(formAlert(page).filter({ hasText: "כבר קיימת קבוצה בשם הזה" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "עריכת הקבוצה שכנים" }).click();
  await page.getByRole("dialog").getByLabel("שם הקבוצה").fill("שכנים מהבניין");
  await page.getByRole("dialog").getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByRole("tabpanel").getByRole("listitem").filter({ hasText: "שכנים מהבניין" })).toBeVisible();

  await page.getByRole("button", { name: "מחיקת הקבוצה שכנים מהבניין" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "מחיקה" }).click();
  await expect(page.getByRole("tabpanel").getByRole("listitem").filter({ hasText: "שכנים מהבניין" })).toHaveCount(0);

  // --- team ---
  await page.getByRole("tab", { name: "צוות והרשאות" }).click();
  await expect(page.getByRole("tabpanel").getByRole("listitem").filter({ hasText: "manager@example.com" })).toContainText("בעלים");

  await page.getByRole("button", { name: "הוספה לצוות" }).click();
  await expect(page.getByText("יש להזין אימייל")).toBeVisible();

  await page.getByLabel("אימייל").fill("outsider@example.com");
  await page.getByRole("button", { name: "הוספה לצוות" }).click();
  await expect(page.getByText("outsider@example.com נוסף/ה לצוות בתפקיד צפייה בלבד")).toBeVisible();
  const outsiderRow = page.getByRole("tabpanel").getByRole("listitem").filter({ hasText: "outsider@example.com" });
  await expect(outsiderRow).toBeVisible();

  await chooseOption(page, outsiderRow.getByRole("combobox"), "צוות כניסה");
  await expect(page.getByText("התפקיד עודכן לצוות כניסה")).toBeVisible();

  await outsiderRow.getByRole("button", { name: /הסרת .* מהצוות/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "הסרה" }).click();
  await expect(outsiderRow).toHaveCount(0);

  const newcomer = `new-${Date.now()}@example.com`;
  await page.getByLabel("אימייל").fill(newcomer);
  await page.getByRole("button", { name: "הוספה לצוות" }).click();
  await expect(page.getByText(/עדיין אין חשבון/)).toBeVisible();
  const pending = page.getByRole("tabpanel").getByRole("listitem").filter({ hasText: newcomer });
  await expect(pending).toContainText("צפייה בלבד");
  await pending.getByRole("button", { name: `ביטול ההזמנה של ${newcomer}` }).click();
  await expect(pending).toHaveCount(0);

  // --- delete ---
  await page.getByRole("tab", { name: "פרטי האירוע" }).click();
  await page.getByRole("button", { name: "מחיקת האירוע" }).click();
  const confirm = page.getByRole("dialog");
  const destroy = confirm.getByRole("button", { name: "מחיקה לצמיתות" });
  await expect(destroy).toBeDisabled();
  await confirm.getByRole("textbox").fill(renamed);
  await destroy.click();
  await expect(page).toHaveURL(/\/events\?deleted=1$/);
  await expect(page.getByText("האירוע נמחק")).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(PREFIX) })).toHaveCount(0);
});

test.describe("viewer", () => {
  test.use({ storageState: storageState("viewer") });

  test("cannot open event settings", async ({ page }) => {
    await page.goto("/events/00000000-0000-4000-b000-000000000001/settings");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
