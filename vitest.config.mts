import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { assertDedicatedTestDatabase } from "./src/test-support/database-safety.ts";

const sourceDirectory = fileURLToPath(new URL("./src", import.meta.url));

assertDedicatedTestDatabase(
  process.env.TEST_DATABASE_URL,
  process.env.DATABASE_URL,
);

export default defineConfig({
  resolve: {
    alias: {
      "@": sourceDirectory,
    },
  },
  test: {
    projects: [
      {
        resolve: { alias: { "@": sourceDirectory } },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.database.test.ts"],
          sequence: { groupOrder: 0 },
        },
      },
      {
        resolve: { alias: { "@": sourceDirectory } },
        test: {
          name: "database",
          include: ["src/**/*.database.test.ts"],
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
