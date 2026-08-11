import { describe, expect, it } from "vitest";

import { withTimeout } from "@/lib/db";

describe("withTimeout", () => {
  it("returns a completed operation", async () => {
    await expect(withTimeout(Promise.resolve("connected"), 20)).resolves.toBe(
      "connected",
    );
  });

  it("rejects an operation that exceeds the deadline", async () => {
    await expect(withTimeout(new Promise(() => undefined), 5)).rejects.toThrow(
      "Database health check timed out.",
    );
  });
});
