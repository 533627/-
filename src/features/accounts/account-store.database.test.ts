import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createPrismaAccountStore } from "@/features/accounts/account-store";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
const prefix = `manage_${randomUUID().replaceAll("-", "").slice(0, 8)}`;

describeWithDatabase.sequential("account management database operations", () => {
  const database = new PrismaClient({
    adapter: new PrismaPg({ connectionString: testDatabaseUrl! }),
  });
  const store = createPrismaAccountStore(database);
  const departmentId = randomUUID();
  const ownerId = randomUUID();
  const operationsAdminId = randomUUID();
  const employeeId = randomUUID();

  beforeAll(async () => {
    await database.department.create({
      data: { id: departmentId, code: `${prefix}_ops`, name: `${prefix}运营部` },
    });
    await createUser({
      id: ownerId,
      username: `${prefix}_owner`,
      role: "SUPER_ADMIN",
      departmentId: null,
    });
    await createUser({
      id: operationsAdminId,
      username: `${prefix}_lead`,
      role: "OPERATIONS_ADMIN",
      departmentId,
    });
    await createUser({
      id: employeeId,
      username: `${prefix}_employee`,
      role: "EMPLOYEE",
      departmentId,
    });
  });

  afterAll(async () => {
    await database.user.deleteMany({
      where: { username: { startsWith: prefix } },
    });
    await database.department.deleteMany({ where: { id: departmentId } });
    await database.$disconnect();
  });

  it("creates a credential account and reports duplicate usernames without storing plaintext", async () => {
    const username = `${prefix}_new`;
    const passwordHash = await hashPassword("StorePassword_2026");
    const account = {
      name: "新客服",
      username,
      email: `${username}@internal.invalid`,
      role: "EMPLOYEE" as const,
      departmentId,
      passwordHash,
    };

    await expect(store.create(account)).resolves.toMatchObject({ username });
    await expect(store.create(account)).rejects.toMatchObject({
      code: "USERNAME_ALREADY_EXISTS",
    });

    const credential = await database.account.findFirstOrThrow({
      where: { user: { username }, providerId: "credential" },
    });
    expect(credential.password).not.toBe("StorePassword_2026");
    await expect(
      verifyPassword({ hash: credential.password!, password: "StorePassword_2026" }),
    ).resolves.toBe(true);
  });

  it("hides highest administrators from the operations administrator list", async () => {
    const page = await store.list(
      { id: operationsAdminId, role: "OPERATIONS_ADMIN", departmentId },
      { page: 1, pageSize: 20, query: prefix },
    );

    expect(page.items.map(({ role }) => role)).not.toContain("SUPER_ADMIN");
    expect(page.items.map(({ username }) => username)).toContain(
      `${prefix}_employee`,
    );
  });

  it("deactivates an employee and atomically revokes every existing session", async () => {
    await database.session.createMany({
      data: [session(employeeId, "one"), session(employeeId, "two")],
    });

    await store.setActive(
      { id: ownerId, role: "SUPER_ADMIN", departmentId: null },
      employeeId,
      false,
    );

    await expect(
      database.user.findUniqueOrThrow({ where: { id: employeeId } }),
    ).resolves.toMatchObject({ isActive: false });
    await expect(
      database.session.count({ where: { userId: employeeId } }),
    ).resolves.toBe(0);
  });

  it("resets the credential password and revokes all old sessions", async () => {
    const nextPassword = "ResetPassword_2026";
    const nextHash = await hashPassword(nextPassword);
    await database.session.create({ data: session(employeeId, "reset") });

    await store.resetPassword(
      { id: ownerId, role: "SUPER_ADMIN", departmentId: null },
      employeeId,
      nextHash,
    );

    const credential = await database.account.findFirstOrThrow({
      where: { userId: employeeId, providerId: "credential" },
    });
    await expect(
      verifyPassword({ hash: credential.password!, password: nextPassword }),
    ).resolves.toBe(true);
    await expect(
      database.session.count({ where: { userId: employeeId } }),
    ).resolves.toBe(0);
  });

  it("rejects an operations administrator targeting a highest administrator", async () => {
    await expect(
      store.resetPassword(
        {
          id: operationsAdminId,
          role: "OPERATIONS_ADMIN",
          departmentId,
        },
        ownerId,
        "unused-hash",
      ),
    ).rejects.toMatchObject({ code: "ACCOUNT_OPERATION_FORBIDDEN" });
  });

  async function createUser(input: {
    id: string;
    username: string;
    role: "SUPER_ADMIN" | "OPERATIONS_ADMIN" | "EMPLOYEE";
    departmentId: string | null;
  }) {
    await database.user.create({
      data: {
        id: input.id,
        name: input.username,
        email: `${input.username}@internal.invalid`,
        emailVerified: true,
        username: input.username,
        displayUsername: input.username,
        role: input.role,
        departmentId: input.departmentId,
        accounts: {
          create: {
            id: randomUUID(),
            accountId: input.id,
            providerId: "credential",
            password: await hashPassword("InitialPassword_2026"),
          },
        },
      },
    });
  }
});

function session(userId: string, suffix: string) {
  return {
    id: randomUUID(),
    token: `${randomUUID()}-${suffix}`,
    userId,
    expiresAt: new Date(Date.now() + 60_000),
  };
}
