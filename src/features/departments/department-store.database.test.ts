import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createPrismaDepartmentStore } from "@/features/departments/department-store";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
const prefix = `dept_${randomUUID().replaceAll("-", "").slice(0, 8)}`;

describeWithDatabase.sequential("department administration database operations", () => {
  const database = new PrismaClient({
    adapter: new PrismaPg({ connectionString: testDatabaseUrl! }),
  });
  const store = createPrismaDepartmentStore(database);
  const originId = randomUUID();
  const destinationId = randomUUID();
  const ownerId = randomUUID();
  const operationsAdminId = randomUUID();
  const memberId = randomUUID();
  const owner = { id: ownerId, role: "SUPER_ADMIN", departmentId: null } as const;
  const operationsAdmin = {
    id: operationsAdminId,
    role: "OPERATIONS_ADMIN",
    departmentId: originId,
  } as const;

  beforeAll(async () => {
    await database.department.createMany({ data: [
      { id: originId, code: `${prefix}_origin`, name: `${prefix}客服部` },
      { id: destinationId, code: `${prefix}_destination`, name: `${prefix}仓库部` },
    ] });
    await database.user.createMany({ data: [
      user(ownerId, `${prefix}_owner`, "SUPER_ADMIN", null),
      user(operationsAdminId, `${prefix}_ops`, "OPERATIONS_ADMIN", originId),
      user(memberId, `${prefix}_member`, "EMPLOYEE", originId),
    ] });
  });

  afterAll(async () => {
    await database.departmentMembershipHistory.deleteMany({
      where: { memberId: { in: [memberId, operationsAdminId] } },
    });
    await database.user.deleteMany({ where: { username: { startsWith: prefix } } });
    await database.department.deleteMany({ where: { id: { in: [originId, destinationId] } } });
    await database.$disconnect();
  });

  it("transfers a member and stores the actor plus both departments atomically", async () => {
    await store.transferMember(operationsAdmin, memberId, destinationId, null);

    await expect(database.user.findUniqueOrThrow({ where: { id: memberId } }))
      .resolves.toMatchObject({ departmentId: destinationId });
    await expect(database.departmentMembershipHistory.findFirstOrThrow({ where: { memberId } }))
      .resolves.toMatchObject({
        memberId,
        fromDepartmentId: originId,
        toDepartmentId: destinationId,
        changedById: operationsAdminId,
      });
  });

  it("limits a department manager list to their own department", async () => {
    const departments = await store.list({
      id: "manager",
      role: "DEPARTMENT_MANAGER",
      departmentId: destinationId,
    });
    expect(departments).toHaveLength(1);
    expect(departments[0]?.id).toBe(destinationId);
  });

  it("refuses to disable a department while active members remain", async () => {
    await expect(store.setActive(owner, destinationId, false)).rejects.toMatchObject({
      code: "DEPARTMENT_HAS_ACTIVE_MEMBERS",
    });
  });

  it("prevents hard deletion because membership history is retained", async () => {
    await expect(database.department.delete({ where: { id: originId } })).rejects.toBeTruthy();
  });

  function user(
    id: string,
    username: string,
    role: "SUPER_ADMIN" | "OPERATIONS_ADMIN" | "EMPLOYEE",
    departmentId: string | null,
  ) {
    return {
      id,
      name: username,
      email: `${username}@internal.invalid`,
      emailVerified: true,
      username,
      displayUsername: username,
      role,
      departmentId,
    };
  }
});
