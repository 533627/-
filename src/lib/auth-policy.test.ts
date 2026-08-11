import { describe, expect, it } from "vitest";

import {
  AUTH_DISABLED_PATHS,
  AUTH_RATE_LIMIT,
  readAuthEnvironment,
  USERNAME_POLICY,
} from "@/lib/auth-policy";

describe("authentication policy", () => {
  it("disables every public account discovery and recovery path", () => {
    expect(AUTH_DISABLED_PATHS).toEqual(
      expect.arrayContaining([
        "/sign-up/email",
        "/sign-in/email",
        "/is-username-available",
        "/request-password-reset",
        "/reset-password",
        "/update-user",
        "/change-email",
      ]),
    );
  });

  it("enforces persistent username login throttling in every environment", () => {
    expect(AUTH_RATE_LIMIT).toMatchObject({
      enabled: true,
      storage: "database",
      customRules: {
        "/sign-in/username": { max: 5, window: 60 },
      },
    });
  });

  it("accepts stable account usernames and rejects ambiguous input", () => {
    expect(USERNAME_POLICY.usernameValidator("ops_lead.01")).toBe(true);
    expect(USERNAME_POLICY.usernameValidator("客服组长")).toBe(false);
    expect(USERNAME_POLICY.usernameValidator("ops-lead")).toBe(false);
    expect(USERNAME_POLICY.usernameNormalization("Ops_Lead.01")).toBe(
      "ops_lead.01",
    );
  });
});

describe("readAuthEnvironment", () => {
  it("accepts an explicit URL and a high-entropy-length secret", () => {
    expect(
      readAuthEnvironment({
        BETTER_AUTH_SECRET: "a".repeat(32),
        BETTER_AUTH_URL: "https://terminal.example.com",
      }),
    ).toEqual({
      BETTER_AUTH_SECRET: "a".repeat(32),
      BETTER_AUTH_URL: "https://terminal.example.com",
    });
  });

  it("rejects a missing or short authentication secret", () => {
    expect(() =>
      readAuthEnvironment({
        BETTER_AUTH_SECRET: "too-short",
        BETTER_AUTH_URL: "https://terminal.example.com",
      }),
    ).toThrow();
  });
});
