import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_DEPARTMENTS } from "@/features/departments/default-departments";
import { seedDepartments } from "@/features/departments/seed-departments";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("seedDepartments database integration", () => {
  const database = new PrismaClient({
    adapter: new PrismaPg({ connectionString: testDatabaseUrl! }),
  });

  beforeAll(async () => {
    await seedDepartments(database);
    await seedDepartments(database);
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it("keeps exactly one active record for each default department", async () => {
    const departments = await database.department.findMany({
      where: { code: { in: DEFAULT_DEPARTMENTS.map(({ code }) => code) } },
      orderBy: { code: "asc" },
      select: { code: true, isActive: true, name: true },
    });

    expect(departments).toHaveLength(DEFAULT_DEPARTMENTS.length);
    expect(departments.every(({ isActive }) => isActive)).toBe(true);
  });
});
