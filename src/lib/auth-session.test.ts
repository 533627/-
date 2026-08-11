import { describe, expect, it, vi } from "vitest";

import {
  AuthenticationRequiredError,
  requireAuthenticatedSession,
} from "@/lib/auth-session";

describe("requireAuthenticatedSession", () => {
  it("returns the authenticated session", async () => {
    const session = { session: { id: "session-1" }, user: { id: "user-1" } };

    await expect(
      requireAuthenticatedSession(
        vi.fn().mockResolvedValue(session),
        new Headers({ cookie: "session=valid" }),
      ),
    ).resolves.toBe(session);
  });

  it("rejects unauthenticated server operations", async () => {
    await expect(
      requireAuthenticatedSession(
        vi.fn().mockResolvedValue(null),
        new Headers(),
      ),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
  });
});
