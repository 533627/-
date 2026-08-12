import { describe, expect, it } from "vitest";

import {
  assertCanTransferMember,
  normalizeDestinationOperationsTeam,
  prepareDepartmentCreation,
} from "@/features/departments/department-management";

const operationsId = "00000000-0000-4000-8000-000000000001";
const serviceId = "00000000-0000-4000-8000-000000000002";
const warehouseId = "00000000-0000-4000-8000-000000000003";
const owner = { id: "owner", role: "SUPER_ADMIN", departmentId: null } as const;
const operationsAdmin = {
  id: "ops-lead",
  role: "OPERATIONS_ADMIN",
  departmentId: operationsId,
} as const;
const departmentManager = {
  id: "service-lead",
  role: "DEPARTMENT_MANAGER",
  departmentId: serviceId,
} as const;

describe("prepareDepartmentCreation", () => {
  it("normalizes a new department for the highest administrator", () => {
    expect(
      prepareDepartmentCreation(owner, { code: "  live-commerce ", name: "  直播部  " }),
    ).toEqual({ code: "LIVE_COMMERCE", name: "直播部" });
  });

  it("denies department structure changes to operations administrators", () => {
    expect(() =>
      prepareDepartmentCreation(operationsAdmin, { code: "LIVE", name: "直播部" }),
    ).toThrowError(expect.objectContaining({ code: "DEPARTMENT_OPERATION_FORBIDDEN" }));
  });
});

describe("operations team transfers", () => {
  it("requires a team when moving a member into operations", () => {
    expect(() => normalizeDestinationOperationsTeam(true, null)).toThrowError(
      expect.objectContaining({ code: "OPERATIONS_TEAM_REQUIRED" }),
    );
    expect(normalizeDestinationOperationsTeam(true, "TEAM_TWO")).toBe("TEAM_TWO");
  });

  it("clears the operations team when moving to another department", () => {
    expect(normalizeDestinationOperationsTeam(false, "TEAM_ONE")).toBeNull();
  });
});

describe("assertCanTransferMember", () => {
  const employee = {
    id: "employee",
    role: "EMPLOYEE",
    departmentId: serviceId,
  } as const;

  it("allows operations administrators to transfer employees across departments", () => {
    expect(() =>
      assertCanTransferMember(operationsAdmin, employee, warehouseId),
    ).not.toThrow();
  });

  it("prevents operations administrators from managing the highest administrator", () => {
    expect(() =>
      assertCanTransferMember(operationsAdmin, { ...owner, departmentId: null }, warehouseId),
    ).toThrowError(expect.objectContaining({ code: "MEMBER_OPERATION_FORBIDDEN" }));
  });

  it("denies personnel transfers to department managers", () => {
    expect(() =>
      assertCanTransferMember(departmentManager, employee, warehouseId),
    ).toThrowError(expect.objectContaining({ code: "MEMBER_OPERATION_FORBIDDEN" }));
  });

  it("rejects a no-op transfer", () => {
    expect(() =>
      assertCanTransferMember(owner, employee, serviceId),
    ).toThrowError(expect.objectContaining({ code: "MEMBER_ALREADY_IN_DEPARTMENT" }));
  });
});
