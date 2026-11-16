import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { EVENTS, password, storageState } from "./fixtures";

const SEATING = `/events/${EVENTS.wedding}/seating`;
const TAG = "E2E הושבה";
const TEST_TABLES = [901, 902, 903];

test.describe.configure({ mode: "serial" });

let manager: SupabaseClient;
test.beforeAll(async () => {
  manager = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  await manager.auth.signInWithPassword({ email: "manager@example.com", password: password() });
  await cleanup();
});
test.afterAll(cleanup);

async function cleanup() {
  await manager.from("guests").delete().eq("event_id", EVENTS.wedding).like("last_name", `${TAG}%`);
  await manager.from("seating_tables").delete().eq("event_id", EVENTS.wedding).in("number", TEST_TABLES);
}

async function createGuest(label: string, seats: number) {
  const last = `${TAG} ${label} ${Date.now()}`;
  const { data, error } = await manager
    .from("guests")
    .insert({
      event_id: EVENTS.wedding,
      first_name: "אורח",
      last_name: last,
      phone: `+97258${Math.floor(Math.random() * 9_000_000) + 1_000_000}`,
      invited_adults: seats,
      rsvp_status: "attending",
      confirmed_adults: seats,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  return { id: data!.id as string, name: `אורח ${last}`, last };
}

const tableOf = async (guestId: string) =>
  (await manager.from("guests").select("table_id").eq("id", guestId).single()).data!.table_id as string | null;
const tableId = async (number: number) =>
  (await manager.from("seating_tables").select("id").eq("event_id", EVENTS.wedding).eq("number", number).single()).data!
    .id as string;

const waiting = (page: Page) => page.getByRole("region", { name: "ממתינים לשיבוץ" });
const table = (page: Page, n: number) => page.getByRole("region", { name: new RegExp(`^שולחן ${n}( ·|$)`) });
const chip = (scope: Locator, name: string) => scope.locator("li").filter({ hasText: name });

/** Pointer drag with dnd-kit's activation distance. */
async function drag(page: Page, from: Locator, to: Locator) {
  await from.scrollIntoViewIfNeeded();
  const a = (await from.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2 + 5, { steps: 4 });
  await to.scrollIntoViewIfNeeded();
  const b = (await to.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + Math.min(b.height / 2, 80), { steps: 12 });
  await page.mouse.up();
}

test.describe("event manager", () => {
  test.use({ storageState: storageState("manager") });

  test("adds a batch of tables and rejects a taken number", async ({ page }) => {
    await cleanup(); // the tests below build on these tables
    await page.goto(SEATING);
    await page.getByRole("button", { name: "הוספת שולחנות" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("מספר (הראשון)").fill("901");
    await dialog.getByLabel("כמה שולחנות").fill("2");
    await dialog.getByLabel("מקומות").fill("3");
    await dialog.getByRole("button", { name: "הוספה" }).click();
    await expect(page.getByText("נוספו 2 שולחנות")).toBeVisible();
    await expect(table(page, 901).locator("[data-slot=table-usage]")).toHaveText("0/3");
    await expect(table(page, 902).locator("[data-slot=table-usage]")).toHaveText("0/3");

    await page.getByRole("button", { name: "הוספת שולחנות" }).click();
    await dialog.getByLabel("מספר (הראשון)").fill("901");
    await dialog.getByLabel("שם (לא חובה)").fill("כפול");
    await dialog.getByRole("button", { name: "הוספה" }).click();
    await expect(dialog.getByText("כבר קיים שולחן מספר 901").first()).toBeVisible();
    await expect(dialog.getByLabel("שם (לא חובה)")).toHaveValue("כפול");
  });

  test("drags guests to tables and blocks a table that is full", async ({ page }) => {
    const a = await createGuest("א", 2);
    const b = await createGuest("ב", 2);
    await page.goto(SEATING);
    await waiting(page).getByRole("searchbox").fill(TAG);
    await expect(chip(waiting(page), a.name)).toBeVisible();

    await drag(page, waiting(page).getByRole("button", { name: `גרירת ${a.name}` }), table(page, 901));
    await expect(page.getByText(`${a.name} שובצו לשולחן 901`)).toBeVisible();
    await expect(chip(table(page, 901), a.name)).toBeVisible();
    await expect(table(page, 901).locator("[data-slot=table-usage]")).toHaveText("2/3");
    await expect(chip(waiting(page), a.name)).toHaveCount(0);
    expect(await tableOf(a.id)).toBe(await tableId(901));

    // 2 more seats do not fit in the 1 that is left
    await drag(page, waiting(page).getByRole("button", { name: `גרירת ${b.name}` }), table(page, 901));
    await expect(page.getByText("אין מספיק מקום בשולחן 901: נותרו 1 מקומות, נדרשים 2")).toBeVisible();
    await expect(chip(waiting(page), b.name)).toBeVisible();
    expect(await tableOf(b.id)).toBeNull();

    // the move menu is the keyboard / touch alternative, and greys out tables that do not fit
    await waiting(page).getByRole("button", { name: `העברת ${b.name} לשולחן` }).click();
    await expect(page.getByRole("menuitem", { name: /^שולחן 901/ })).toBeDisabled();
    await page.getByRole("menuitem", { name: /^שולחן 902/ }).click();
    await expect(page.getByText(`${b.name} שובצו לשולחן 902`)).toBeVisible();
    await expect(chip(table(page, 902), b.name)).toBeVisible();
    expect(await tableOf(b.id)).toBe(await tableId(902));

    // drag back out of the table
    await drag(page, table(page, 901).getByRole("button", { name: `גרירת ${a.name}` }), waiting(page));
    await expect(page.getByText(`${a.name} הוחזרו לרשימת הממתינים`)).toBeVisible();
    await expect(chip(waiting(page), a.name)).toBeVisible();
    await expect(table(page, 901).locator("[data-slot=table-usage]")).toHaveText("0/3");
    expect(await tableOf(a.id)).toBeNull();
  });

  test("cannot shrink a table below its guests; deleting it frees them", async ({ page }) => {
    await page.goto(SEATING);
    await table(page, 902).getByRole("button", { name: /^פעולות לשולחן 902/ }).click();
    await page.getByRole("menuitem", { name: "עריכה" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("מקומות").fill("1");
    await dialog.getByRole("button", { name: "שמירת השינויים" }).click();
    await expect(dialog.getByText("בשולחן 902 כבר משובצים 2 אורחים, לא ניתן להקטין ל-1").first()).toBeVisible();
    await dialog.getByLabel("מקומות").fill("6");
    await dialog.getByLabel("שם (לא חובה)").fill("שולחן בדיקה");
    await dialog.getByRole("button", { name: "שמירת השינויים" }).click();
    await expect(page.getByText("השולחן עודכן")).toBeVisible();
    await expect(table(page, 902)).toHaveAccessibleName("שולחן 902 · שולחן בדיקה");
    await expect(table(page, 902).locator("[data-slot=table-usage]")).toHaveText("2/6");

    await table(page, 902).getByRole("button", { name: /^פעולות לשולחן 902/ }).click();
    await page.getByRole("menuitem", { name: "מחיקה" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("ההזמנות שמשובצות בו יחזרו לרשימת הממתינים");
    await confirm.getByRole("button", { name: "מחיקה" }).click();
    await expect(page.getByText("שולחן 902 נמחק")).toBeVisible();
    await expect(table(page, 902)).toHaveCount(0);
    await waiting(page).getByRole("searchbox").fill(TAG);
    await expect(waiting(page).locator("li").filter({ hasText: TAG })).toHaveCount(2);
  });
});

test.describe("viewer", () => {
  test.use({ storageState: storageState("viewer") });

  test("sees the tables but cannot change them", async ({ page }) => {
    await page.goto(SEATING);
    await expect(table(page, 1)).toBeVisible();
    await expect(page.getByRole("button", { name: "הוספת שולחנות" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^גרירת/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^העברת/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^פעולות לשולחן/ })).toHaveCount(0);
  });
});
