import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { EVENTS, password, seedAdminIsPlatformAdmin, storageState } from "./fixtures";

const tile = (page: Page, label: string) =>
  page.getByRole("group", { name: label, exact: true }).locator("[data-slot=stat-value]");

test.describe("platform admin", () => {
  test.use({ storageState: storageState("admin") });

  test.beforeEach(async () => {
    // in production the owner's own account is the only platform admin
    test.skip(!(await seedAdminIsPlatformAdmin()), "admin@example.com is not a platform admin in this database");
  });

  // whatever happens in the test, outsider@example.com ends up a regular user
  test.afterAll(async () => {
    if (!(await seedAdminIsPlatformAdmin())) return;
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
    await supabase.auth.signInWithPassword({ email: "admin@example.com", password: password() });
    const { data } = await supabase.from("profiles").select("id").eq("email", "outsider@example.com").single();
    await supabase.rpc("set_platform_admin", { p_user_id: data!.id, p_is_admin: false });
  });

  test("sees every user and event", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "ניהול מערכת", level: 1 })).toBeVisible();
    expect(Number(await tile(page, "משתמשים").textContent())).toBeGreaterThanOrEqual(5);
    expect(Number(await tile(page, "אירועים").textContent())).toBeGreaterThanOrEqual(3);

    const users = page.getByRole("table", { name: "משתמשים רשומים" });
    const managerRow = users.getByRole("row").filter({ hasText: "manager@example.com" });
    await expect(managerRow).toContainText("נועה כהן");
    await expect(managerRow).toContainText("אושר");

    // the admin's own row has no button to drop their own rights
    const selfRow = users.getByRole("row").filter({ hasText: "admin@example.com" });
    await expect(selfRow).toContainText("(את/ה)");
    await expect(selfRow).toContainText("מנהל מערכת");
    await expect(selfRow.getByRole("button")).toHaveCount(0);

    await page.getByRole("searchbox", { name: "חיפוש משתמש או אירוע" }).fill("viewer@");
    await expect(users.locator("tbody tr")).toHaveCount(1);

    await page.getByRole("searchbox", { name: "חיפוש משתמש או אירוע" }).fill("");
    await page.getByRole("tab", { name: /אירועים/ }).click();
    const events = page.getByRole("table", { name: "כל האירועים במערכת" });
    const wedding = events.getByRole("row").filter({ hasText: "חתונת נועה ואיתי" });
    await expect(wedding).toContainText("manager@example.com");
    await wedding.getByRole("link", { name: "חתונת נועה ואיתי" }).click();
    await expect(page).toHaveURL(`/events/${EVENTS.wedding}/dashboard`);
  });

  test("grants and removes admin rights after confirmation", async ({ page }) => {
    await page.goto("/admin");
    const row = page.getByRole("table", { name: "משתמשים רשומים" }).getByRole("row").filter({ hasText: "outsider@example.com" });
    await expect(row).toContainText("משתמש");

    await row.getByRole("button", { name: /^הענקת הרשאת מנהל ל/ }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("להעניק הרשאת מנהל מערכת?");
    await confirm.getByRole("button", { name: "ביטול" }).click();
    await expect(row).not.toContainText("מנהל מערכת");

    await row.getByRole("button", { name: /^הענקת הרשאת מנהל ל/ }).click();
    await confirm.getByRole("button", { name: "הענקת ההרשאה" }).click();
    await expect(page.getByText("הרשאת מנהל המערכת הוענקה: משתמש חיצוני")).toBeVisible();
    await expect(row).toContainText("מנהל מערכת");
    await expect(page.getByRole("group", { name: "מוזמנים בכל האירועים" })).toContainText("2 מנהלי מערכת");

    await row.getByRole("button", { name: /^הסרת הרשאת מנהל ל/ }).click();
    await confirm.getByRole("button", { name: "הסרת ההרשאה" }).click();
    await expect(page.getByText("הרשאת מנהל המערכת הוסרה: משתמש חיצוני")).toBeVisible();
    await expect(row.getByRole("button", { name: /^הענקת הרשאת מנהל ל/ })).toBeVisible();
  });
});

test.describe("regular user", () => {
  test.use({ storageState: storageState("manager") });

  test("cannot open the admin panel", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL("/events");
  });
});
