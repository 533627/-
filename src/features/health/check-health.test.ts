import { describe, expect, it, vi } from "vitest";

import { checkHealth } from "@/features/health/check-health";

describe("checkHealth", () => {
  it("reports a healthy database without logging an error", async () => {
    const logFailure = vi.fn();

    const result = await checkHealth({
      checkDatabase: vi.fn().mockResolvedValue(undefined),
      checkedAt: () => new Date("2026-08-11T03:30:00.000Z"),
      logFailure,
      requestId: "request-ok",
    });

    expect(result).toEqual({
      body: {
        checkedAt: "2026-08-11T03:30:00.000Z",
        checks: { database: "ok" },
        status: "ok",
      },
      status: 200,
    });
    expect(logFailure).not.toHaveBeenCalled();
  });

  it("reports an unavailable database without exposing the failure", async () => {
    const logFailure = vi.fn();

    const result = await checkHealth({
      checkDatabase: vi.fn().mockRejectedValue(new Error("secret connection details")),
      checkedAt: () => new Date("2026-08-11T03:31:00.000Z"),
      logFailure,
      requestId: "request-failed",
    });

    expect(result).toEqual({
      body: {
        checkedAt: "2026-08-11T03:31:00.000Z",
        checks: { database: "unavailable" },
        status: "degraded",
      },
      status: 503,
    });
    expect(JSON.stringify(result)).not.toContain("secret connection details");
    expect(logFailure).toHaveBeenCalledWith({
      component: "database",
      errorName: "Error",
      event: "health_check_failed",
      requestId: "request-failed",
    });
  });
});
