import { expect, test } from "@playwright/test";
import { EVENTS, storageState } from "./fixtures";

test.use({ storageState: storageState("manager") });

test("sidebar opens as a drawer from the right on phones", async ({ page }) => {
  await page.goto(`/events/${EVENTS.wedding}/dashboard`);
  const nav = page.getByRole("link", { name: "מוזמנים" });
  await expect(nav).toBeHidden();

  await page.getByRole("button", { name: "פתיחה וסגירה של התפריט" }).click();
  await expect(nav).toBeVisible();
  const viewport = page.viewportSize()!;
  // anchored to the right edge once the slide-in animation settles
  await expect
    .poll(async () => {
      const box = await page.getByRole("dialog").boundingBox();
      return box ? Math.round(box.x + box.width) : null;
    })
    .toBe(viewport.width);

  await nav.click();
  await expect(page).toHaveURL(`/events/${EVENTS.wedding}/guests`);
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("no horizontal scrolling on the events page", async ({ page }) => {
  await page.goto("/events");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
