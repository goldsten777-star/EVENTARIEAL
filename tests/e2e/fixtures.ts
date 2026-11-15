import { expect, type Page } from "@playwright/test";

export const EVENTS = {
  wedding: "00000000-0000-4000-b000-000000000001",
  barMitzvah: "00000000-0000-4000-b000-000000000002",
  conference: "00000000-0000-4000-b000-000000000003",
} as const;

export const ROLES = ["manager", "viewer", "checkin", "outsider", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const storageState = (role: Role) => `tests/e2e/.auth/${role}.json`;

export function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is missing (see .env.example)");
  return value;
}

export async function loginThroughForm(page: Page, role: Role, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("אימייל").fill(`${role}@example.com`);
  await page.getByLabel("סיסמה", { exact: true }).fill(password());
  await page.getByRole("button", { name: "התחברות" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
