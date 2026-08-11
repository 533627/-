import { describe, expect, it } from "vitest";

import { DEFAULT_DEPARTMENTS } from "@/features/departments/default-departments";

describe("DEFAULT_DEPARTMENTS", () => {
  it("defines the four confirmed company departments", () => {
    expect(DEFAULT_DEPARTMENTS).toEqual([
      { code: "OPERATIONS", name: "运营部" },
      { code: "CUSTOMER_SERVICE", name: "客服部" },
      { code: "PROCUREMENT", name: "采购部" },
      { code: "WAREHOUSE", name: "仓库部" },
    ]);
  });

  it("uses unique stable codes", () => {
    const codes = DEFAULT_DEPARTMENTS.map(({ code }) => code);

    expect(new Set(codes).size).toBe(DEFAULT_DEPARTMENTS.length);
  });
});
