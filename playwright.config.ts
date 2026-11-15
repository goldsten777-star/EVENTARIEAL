import { defineConfig, devices } from "@playwright/test";

// make .env.local (E2E_PASSWORD, Supabase keys) available to the tests
try {
  process.loadEnvFile(".env.local");
} catch {
  // CI provides the variables directly
}

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // a deployed site answers over the internet: allow more time than localhost
  expect: { timeout: process.env.E2E_BASE_URL ? 15_000 : 5_000 },
  use: {
    baseURL,
    locale: "he-IL",
    trace: "off",
    // Chromium needs a UTF-8 system locale to keep Hebrew download file names
    launchOptions: { env: { ...process.env, LANG: "C.UTF-8", LC_ALL: "C.UTF-8" } },
  },
  projects: [
    // signs each seeded role in once and saves the session for the other tests
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testIgnore: /\.mobile\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      dependencies: ["setup"],
      testMatch: /(smoke|\.mobile)\.spec\.ts/,
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run start -- -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
