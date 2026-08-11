import { describe, expect, it } from "vitest";

import {
  getNavigationForRole,
  getRoleHomeCopy,
  getWorkspaceModule,
} from "@/features/shell/navigation";

describe("role-aware workspace navigation", () => {
  it("shows every administration entry to the highest administrator", () => {
    expect(getNavigationForRole("SUPER_ADMIN").map(({ href }) => href)).toEqual([
      "/",
      "/business-models",
      "/projects",
      "/tasks",
      "/conversations",
      "/accounts",
      "/departments",
      "/audit",
    ]);
  });

  it("lets the operations administrator manage accounts without super-admin structure access", () => {
    const hrefs = getNavigationForRole("OPERATIONS_ADMIN").map(
      ({ href }) => href,
    );

    expect(hrefs).toContain("/accounts");
    expect(hrefs).toContain("/business-models");
    expect(hrefs).not.toContain("/departments");
    expect(hrefs).not.toContain("/audit");
  });

  it("limits employees to their daily collaboration workspace", () => {
    expect(getNavigationForRole("EMPLOYEE").map(({ href }) => href)).toEqual([
      "/",
      "/projects",
      "/tasks",
      "/conversations",
    ]);
  });

  it("uses the same capability contract for direct module access", () => {
    expect(getWorkspaceModule("accounts", "SUPER_ADMIN")?.href).toBe(
      "/accounts",
    );
    expect(getWorkspaceModule("accounts", "EMPLOYEE")).toBeNull();
    expect(getWorkspaceModule("unknown", "SUPER_ADMIN")).toBeNull();
  });

  it("provides role-specific landing copy without inventing business metrics", () => {
    expect(getRoleHomeCopy("SUPER_ADMIN").title).toContain("全公司");
    expect(getRoleHomeCopy("DEPARTMENT_MANAGER").title).toContain("部门");
    expect(getRoleHomeCopy("EMPLOYEE").title).toContain("任务");
  });
});
