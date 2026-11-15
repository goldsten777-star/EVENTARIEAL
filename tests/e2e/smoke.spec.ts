import { expect, test } from "@playwright/test";

test("home page renders in Hebrew, right-to-left", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "he");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("כל האירוע במקום אחד");
  await expect(page.getByRole("link", { name: "יצירת חשבון" })).toBeVisible();
});

test("theme toggle switches to dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "מעבר למצב כהה" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("private pages redirect to login when signed out", async ({ page }) => {
  const response = await page.goto("/events");
  expect(page.url()).toContain("/login?next=%2Fevents");
  expect(response?.status()).toBeLessThan(500);
});

test("security headers are set", async ({ request }) => {
  const res = await request.get("/");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
});
