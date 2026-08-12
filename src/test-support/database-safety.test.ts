import { describe, expect, it } from "vitest";

import {
  assertDedicatedTestDatabase,
  bootstrapTestUserFilter,
  requireDedicatedTestDatabase,
} from "@/test-support/database-safety";

describe("database test safety", () => {
  it("rejects running destructive database tests against the application database", () => {
    expect(() =>
      assertDedicatedTestDatabase(
        "postgresql://postgres:postgres@localhost:51214/template1?sslmode=disable",
        "postgresql://postgres:postgres@localhost:51214/template1?connection_limit=10&sslmode=disable",
      ),
    ).toThrow("TEST_DATABASE_URL must point to a dedicated test database");
  });

  it("allows a distinct dedicated test database", () => {
    expect(() =>
      assertDedicatedTestDatabase(
        "postgresql://postgres:postgres@localhost:51214/company_ops_test",
        "postgresql://postgres:postgres@localhost:51214/template1",
      ),
    ).not.toThrow();
  });

  it("requires browser tests to receive an explicit test database", () => {
    expect(() => requireDedicatedTestDatabase(undefined, "postgresql://localhost/app"))
      .toThrow("TEST_DATABASE_URL is required");
  });

  it("scopes bootstrap cleanup to test usernames", () => {
    expect(bootstrapTestUserFilter()).toEqual({
      role: "SUPER_ADMIN",
      username: { startsWith: "bootstrap_test_" },
    });
  });
});
