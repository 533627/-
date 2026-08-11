import { describe, expect, it, vi } from "vitest";

import {
  bootstrapSuperAdmin,
  generateTemporaryPassword,
  type BootstrapAdminStore,
} from "@/features/accounts/bootstrap-admin";

describe("generateTemporaryPassword", () => {
  it("generates a high-entropy-length URL-safe password", () => {
    const password = generateTemporaryPassword();

    expect(password).toHaveLength(32);
    expect(password).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("bootstrapSuperAdmin", () => {
  it("normalizes the username and stores only a password hash", async () => {
    const createFirstSuperAdmin = vi.fn().mockResolvedValue("created");
    const store: BootstrapAdminStore = { createFirstSuperAdmin };
    const password = "OneTimePassword_2026";

    const credentials = await bootstrapSuperAdmin(
      store,
      { username: "  Boss.Admin  ", name: "  公司老板  " },
      {
        generatePassword: () => password,
        hashPassword: async () => "stored-scrypt-hash",
      },
    );

    expect(credentials).toEqual({ username: "boss.admin", password });
    expect(createFirstSuperAdmin).toHaveBeenCalledWith({
      name: "公司老板",
      username: "boss.admin",
      email: "boss.admin@internal.invalid",
      passwordHash: "stored-scrypt-hash",
    });
    expect(JSON.stringify(createFirstSuperAdmin.mock.calls)).not.toContain(password);
  });

  it("rejects repeated initialization without returning credentials", async () => {
    const store: BootstrapAdminStore = {
      createFirstSuperAdmin: vi.fn().mockResolvedValue("already_exists"),
    };

    await expect(
      bootstrapSuperAdmin(
        store,
        { username: "boss", name: "老板" },
        {
          generatePassword: () => "NeverPrintedPassword_2026",
          hashPassword: async () => "stored-scrypt-hash",
        },
      ),
    ).rejects.toMatchObject({
      code: "SUPER_ADMIN_ALREADY_EXISTS",
    });
  });

  it("rejects invalid usernames before touching the database", async () => {
    const createFirstSuperAdmin = vi.fn();
    const store: BootstrapAdminStore = { createFirstSuperAdmin };

    await expect(
      bootstrapSuperAdmin(store, { username: "老板", name: "老板" }),
    ).rejects.toMatchObject({
      code: "INVALID_BOOTSTRAP_INPUT",
    });
    expect(createFirstSuperAdmin).not.toHaveBeenCalled();
  });
});
