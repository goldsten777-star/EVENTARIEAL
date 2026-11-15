import { test as setup } from "@playwright/test";
import { loginThroughForm, ROLES, storageState } from "./fixtures";

for (const role of ROLES) {
  setup(`sign in as ${role}`, async ({ page }) => {
    await loginThroughForm(page, role);
    await page.context().storageState({ path: storageState(role) });
  });
}
