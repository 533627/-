import { PrismaPg } from "@prisma/adapter-pg";
import { verifyPassword } from "better-auth/crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { bootstrapSuperAdmin } from "@/features/accounts/bootstrap-admin";
import { createPrismaBootstrapAdminStore } from "@/features/accounts/bootstrap-admin-store";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("super-admin bootstrap database integration", () => {
  const database = new PrismaClient({
    adapter: new PrismaPg({ connectionString: testDatabaseUrl! }),
  });
  const store = createPrismaBootstrapAdminStore(database);

  beforeEach(async () => {
    await database.user.deleteMany({
      where: { role: "SUPER_ADMIN" },
    });
  });

  afterAll(async () => {
    await database.user.deleteMany({
      where: { username: { startsWith: "bootstrap_test_" } },
    });
    await database.$disconnect();
  });

  it("creates a department-free SUPER_ADMIN with only a password hash stored", async () => {
    const username = "bootstrap_test_owner";
    const credentials = await bootstrapSuperAdmin(store, {
      username,
      name: "测试老板",
    });

    const user = await database.user.findUniqueOrThrow({
      where: { username },
      include: { accounts: true },
    });

    expect(user).toMatchObject({
      username,
      role: "SUPER_ADMIN",
      departmentId: null,
    });
    expect(user.accounts).toHaveLength(1);
    expect(user.accounts[0].providerId).toBe("credential");
    expect(user.accounts[0].password).not.toBe(credentials.password);
    await expect(
      verifyPassword({
        hash: user.accounts[0].password!,
        password: credentials.password,
      }),
    ).resolves.toBe(true);
  });

  it("rejects a second initialization and preserves the original administrator", async () => {
    await bootstrapSuperAdmin(store, {
      username: "bootstrap_test_first",
      name: "第一位老板",
    });

    await expect(
      bootstrapSuperAdmin(store, {
        username: "bootstrap_test_second",
        name: "第二位老板",
      }),
    ).rejects.toMatchObject({ code: "SUPER_ADMIN_ALREADY_EXISTS" });
    await expect(
      database.user.count({ where: { role: "SUPER_ADMIN" } }),
    ).resolves.toBe(1);
  });

  it("allows only one concurrent initialization to succeed", async () => {
    const results = await Promise.allSettled([
      bootstrapSuperAdmin(store, {
        username: "bootstrap_test_concurrent_a",
        name: "并发老板 A",
      }),
      bootstrapSuperAdmin(store, {
        username: "bootstrap_test_concurrent_b",
        name: "并发老板 B",
      }),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    await expect(
      database.user.count({ where: { role: "SUPER_ADMIN" } }),
    ).resolves.toBe(1);
  });
});
