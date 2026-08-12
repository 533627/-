import { describe, expect, it } from "vitest";

import {
  assertProjectManager,
  canAccessProject,
  nextProjectRevision,
  prepareDirectProjectInput,
  ProjectManagementError,
  validateProjectStatusTransition,
} from "@/features/projects/project-management";

describe("project access and management rules", () => {
  it("lets only the super admin prepare a direct project without an approval request", () => {
    expect(
      prepareDirectProjectInput(
        { id: "owner", role: "SUPER_ADMIN", departmentId: null },
        {
          businessModelId: "00000000-0000-4000-8000-000000000010",
          leadId: "operations-lead",
          name: "  新渠道试跑  ",
          objective: "  先建立项目，再逐步补充目标  ",
        },
      ),
    ).toEqual({
      businessModelId: "00000000-0000-4000-8000-000000000010",
      leadId: "operations-lead",
      name: "新渠道试跑",
      objective: "先建立项目，再逐步补充目标",
    });

    expect(() =>
      prepareDirectProjectInput(
        { id: "ops", role: "OPERATIONS_ADMIN", departmentId: "ops" },
        {
          businessModelId: "00000000-0000-4000-8000-000000000010",
          leadId: "operations-lead",
          name: "越权项目",
          objective: "",
        },
      ),
    ).toThrowError(expect.objectContaining({ code: "PROJECT_MANAGE_FORBIDDEN" }));
  });
  it("lets the highest administrator manage every project", () => {
    expect(() => assertProjectManager({ id: "owner", role: "SUPER_ADMIN", departmentId: null })).not.toThrow();
  });

  it("does not let an operations administrator manage project membership", () => {
    expect(() => assertProjectManager({ id: "ops", role: "OPERATIONS_ADMIN", departmentId: "ops" }))
      .toThrowError(new ProjectManagementError("PROJECT_MANAGE_FORBIDDEN"));
  });

  it("grants detail access only to the highest administrator or an active member", () => {
    expect(canAccessProject("SUPER_ADMIN", false)).toBe(true);
    expect(canAccessProject("EMPLOYEE", true)).toBe(true);
    expect(canAccessProject("OPERATIONS_ADMIN", false)).toBe(false);
  });

  it.each([
    ["PREPARING", "IN_PROGRESS"],
    ["PREPARING", "ARCHIVED"],
    ["IN_PROGRESS", "PAUSED"],
    ["IN_PROGRESS", "COMPLETED"],
    ["PAUSED", "IN_PROGRESS"],
    ["PAUSED", "ARCHIVED"],
    ["COMPLETED", "ARCHIVED"],
  ] as const)("allows the %s to %s status transition", (from, to) => {
    expect(validateProjectStatusTransition(from, to)).toBe(to);
  });

  it.each([
    ["PREPARING", "COMPLETED"],
    ["COMPLETED", "IN_PROGRESS"],
    ["ARCHIVED", "PREPARING"],
  ] as const)("rejects the %s to %s status transition", (from, to) => {
    expect(() => validateProjectStatusTransition(from, to))
      .toThrowError(new ProjectManagementError("PROJECT_STATUS_TRANSITION_INVALID"));
  });

  it("advances the project revision used by the next timeline event", () => {
    expect(nextProjectRevision(4)).toBe(5);
  });
});
