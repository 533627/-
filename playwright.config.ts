import { defineConfig, devices } from "@playwright/test";

import { requireDedicatedTestDatabase } from "./src/test-support/database-safety";

requireDedicatedTestDatabase(
  process.env.TEST_DATABASE_URL,
  process.env.DATABASE_URL,
);

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const serverCommand = process.env.PLAYWRIGHT_USE_BUILD
  ? `node node_modules/next/dist/bin/next start --port ${port}`
  : `node node_modules/next/dist/bin/next dev --port ${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: serverCommand,
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
