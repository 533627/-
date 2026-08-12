import { defineConfig, devices } from "@playwright/test";

import { requireDedicatedTestDatabase } from "./src/test-support/database-safety";

requireDedicatedTestDatabase(
  process.env.TEST_DATABASE_URL,
  process.env.DATABASE_URL,
);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
});
