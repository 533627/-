import { describe, expect, it, vi } from "vitest";

import { seedDepartments } from "@/features/departments/seed-departments";

describe("seedDepartments", () => {
  it("upserts every default department so repeated runs stay idempotent", async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    const store = { department: { upsert } };

    await seedDepartments(store);
    await seedDepartments(store);

    expect(upsert).toHaveBeenCalledTimes(8);
    expect(upsert).toHaveBeenCalledWith({
      where: { code: "OPERATIONS" },
      update: { isActive: true, name: "运营部" },
      create: { code: "OPERATIONS", isActive: true, name: "运营部" },
    });
  });
});
