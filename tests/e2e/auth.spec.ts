import { expect, test, type Page } from "@playwright/test";
import { EVENTS, loginThroughForm, storageState } from "./fixtures";

// Next.js renders an empty role="alert" route announcer; skip it
const formAlert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

test.describe("signed out", () => {
  test("login form validates in the browser before submitting", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "התחברות" }).click();
    await expect(page.getByText("יש להזין אימייל")).toBeVisible();
    await expect(page.getByText("יש להזין סיסמה")).toBeVisible();
    await expect(page.getByLabel("אימייל")).toHaveAttribute("aria-invalid", "true");
  });

  test("wrong password shows a Hebrew error and keeps the email", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("אימייל").fill("manager@example.com");
    await page.getByLabel("סיסמה", { exact: true }).fill("wrong-password-1");
    await page.getByRole("button", { name: "התחברות" }).click();
    await expect(formAlert(page)).toHaveText("אימייל או סיסמה שגויים");
    await expect(page.getByLabel("אימייל")).toHaveValue("manager@example.com");
    await expect(page).toHaveURL(/\/login/);
  });

  test("password field can be revealed", async ({ page }) => {
    await page.goto("/login");
    const field = page.getByLabel("סיסמה", { exact: true });
    await field.fill("abc");
    await expect(field).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "הצגת הסיסמה" }).click();
    await expect(field).toHaveAttribute("type", "text");
  });

  test("signup form validates every field", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("אימייל").fill("not-an-email");
    await page.getByLabel("סיסמה", { exact: true }).fill("short");
    await page.getByLabel("אימות סיסמה").fill("other");
    await page.getByRole("button", { name: "יצירת חשבון" }).click();
    await expect(page.getByText("יש להזין שם מלא")).toBeVisible();
    await expect(page.getByText("כתובת אימייל לא תקינה")).toBeVisible();
    await expect(page.getByText(/הסיסמה קצרה מדי/)).toBeVisible();
    await expect(page.getByText("הסיסמאות אינן תואמות")).toBeVisible();
  });

  test("forgot-password form validates the email", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByRole("button", { name: "שליחת קישור לאיפוס" }).click();
    await expect(page.getByText("יש להזין אימייל")).toBeVisible();
  });

  test("expired email links land on login with an explanation", async ({ page }) => {
    await page.goto("/auth/callback?code=invalid");
    await expect(page).toHaveURL(/\/login\?error=link/);
    await expect(formAlert(page)).toContainText("הקישור אינו תקף");
  });

  test("login returns to the requested page, and logout works", async ({ page }) => {
    const target = `/events/${EVENTS.wedding}/guests`;
    await page.goto(target);
    await expect(page).toHaveURL(/\/login\?next=/);
    await loginThroughForm(page, "manager", target);
    await expect(page).toHaveURL(target);

    await page.getByRole("button", { name: "תפריט משתמש" }).click();
    await page.getByRole("menuitem", { name: "התנתקות" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto(target);
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test("open redirects are refused", async ({ page }) => {
    await loginThroughForm(page, "viewer", "//evil.example.com");
    await expect(page).toHaveURL(/\/events$/);
  });
});

test.describe("event manager", () => {
  test.use({ storageState: storageState("manager") });

  test("is kept away from login and signup", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/events$/);
  });

  test("sees their events and the full navigation", async ({ page }) => {
    await page.goto("/events");
    await expect(page.getByRole("heading", { level: 1, name: "האירועים שלי" })).toBeVisible();
    await expect(page.getByRole("link", { name: /חתונת נועה ואיתי/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /בר המצווה של יונתן/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /כנס לקוחות שנתי/ })).toHaveCount(0);

    await page.getByRole("link", { name: /חתונת נועה ואיתי/ }).click();
    await expect(page).toHaveURL(`/events/${EVENTS.wedding}/dashboard`);

    const nav = page.locator("[data-sidebar=sidebar]");
    for (const label of ["לוח בקרה", "מוזמנים", "הזמנות ואישורים", "סידורי ישיבה", "מתנות", "תקציב", "Check-in", "דוחות", "הגדרות וצוות"]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "לוח בקרה" })).toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "מוזמנים" }).click();
    await expect(page).toHaveURL(`/events/${EVENTS.wedding}/guests`);
    await expect(page.getByRole("heading", { level: 1, name: "מוזמנים" })).toBeVisible();
  });

  test("switches between events", async ({ page }) => {
    await page.goto(`/events/${EVENTS.wedding}/dashboard`);
    await page.getByRole("button", { name: /האירוע הנוכחי: חתונת נועה ואיתי/ }).click();
    await page.getByRole("menuitem", { name: /בר המצווה של יונתן/ }).click();
    await expect(page).toHaveURL(`/events/${EVENTS.barMitzvah}/dashboard`);
  });

  test("gets 404 for someone else's event and for malformed ids", async ({ page }) => {
    const res = await page.goto(`/events/${EVENTS.conference}/dashboard`);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "הדף לא נמצא" })).toBeVisible();
    const bad = await page.goto("/events/not-a-uuid");
    expect(bad?.status()).toBe(404);
  });

  test("cannot open the admin area", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/events$/);
  });
});

test.describe("viewer", () => {
  test.use({ storageState: storageState("viewer") });

  test("has no check-in or settings, and is redirected away from them", async ({ page }) => {
    await page.goto(`/events/${EVENTS.wedding}`);
    await expect(page).toHaveURL(`/events/${EVENTS.wedding}/dashboard`);
    const nav = page.locator("[data-sidebar=sidebar]");
    await expect(nav.getByRole("link", { name: "מוזמנים" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Check-in" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "הגדרות וצוות" })).toHaveCount(0);
    await expect(page.getByText("צפייה בלבד").first()).toBeVisible();

    await page.goto(`/events/${EVENTS.wedding}/settings`);
    await expect(page).toHaveURL(`/events/${EVENTS.wedding}/dashboard`);
  });
});

test.describe("check-in staff", () => {
  test.use({ storageState: storageState("checkin") });

  test("lands on check-in and sees nothing else", async ({ page }) => {
    await page.goto(`/events/${EVENTS.wedding}`);
    await expect(page).toHaveURL(`/events/${EVENTS.wedding}/checkin`);
    const links = page.locator("[data-sidebar=sidebar] [data-sidebar=menu-button]");
    await expect(links).toHaveCount(1);
    await expect(links.first()).toHaveText("Check-in");

    await page.goto(`/events/${EVENTS.wedding}/guests`);
    await expect(page).toHaveURL(`/events/${EVENTS.wedding}/checkin`);
  });
});

test.describe("outsider", () => {
  test.use({ storageState: storageState("outsider") });

  test("cannot reach another customer's event", async ({ page }) => {
    const res = await page.goto(`/events/${EVENTS.wedding}/guests`);
    expect(res?.status()).toBe(404);
  });
});

test.describe("platform admin", () => {
  test.use({ storageState: storageState("admin") });

  test("sees every event and the admin area", async ({ page }) => {
    await page.goto("/events");
    await expect(page.getByRole("link", { name: /כנס לקוחות שנתי/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /חתונת נועה ואיתי/ })).toBeVisible();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "ניהול מערכת" })).toBeVisible();
  });
});
