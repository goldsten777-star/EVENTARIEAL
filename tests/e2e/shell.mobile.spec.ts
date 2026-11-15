import { expect, test } from "@playwright/test";
import { EVENTS, storageState } from "./fixtures";

test.use({ storageState: storageState("manager") });

test("sidebar opens as a drawer from the right on phones", async ({ page }) => {
  await page.goto(`/events/${EVENTS.wedding}/dashboard`);
  const nav = page.getByRole("link", { name: "מוזמנים", exact: true });
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

// A too-wide page makes mobile browsers widen the layout viewport (and zoom
// out), so innerWidth itself grows: compare it with the device width instead.
for (const path of [
  "/events",
  `/events/${EVENTS.wedding}/dashboard`,
  `/events/${EVENTS.wedding}/guests`,
  `/events/${EVENTS.wedding}/gifts`,
  `/events/${EVENTS.wedding}/budget`,
  `/events/${EVENTS.wedding}/settings`,
]) {
  test(`no horizontal overflow on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const width = await page.evaluate(() => ({ layout: window.innerWidth, doc: document.documentElement.scrollWidth }));
    expect(width.layout).toBe(page.viewportSize()!.width);
    expect(width.doc).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
}
