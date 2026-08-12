import { describe, expect, it } from "vitest";

import {
  CAPABILITIES,
  ROLES,
  type Actor,
} from "@/lib/authz/types";
import {
  PERMISSION_MATRIX,
  canAdministerAccount,
  canAssignTask,
  canAccessDepartmentConversation,
  canAccessProjectConversation,
  canAccessOperationsTeamConversation,
  canManageDepartmentWork,
  canViewDepartmentMembers,
  hasCapability,
} from "@/lib/authz/permissions";

const superAdmin: Actor = {
  id: "super-admin",
  role: "SUPER_ADMIN",
  departmentId: null,
};
const operationsAdmin: Actor = {
  id: "operations-admin",
  role: "OPERATIONS_ADMIN",
  departmentId: "operations",
  operationsTeam: "TEAM_ONE",
};
const customerServiceManager: Actor = {
  id: "customer-service-manager",
  role: "DEPARTMENT_MANAGER",
  departmentId: "customer-service",
};
const employee: Actor = {
  id: "employee",
  role: "EMPLOYEE",
  departmentId: "customer-service",
};

describe("permission matrix", () => {
  it("defines a boolean decision for every capability and role", () => {
    expect(Object.keys(PERMISSION_MATRIX).sort()).toEqual(
      [...CAPABILITIES].sort(),
    );

    for (const capability of CAPABILITIES) {
      expect(Object.keys(PERMISSION_MATRIX[capability]).sort()).toEqual(
        [...ROLES].sort(),
      );

      for (const role of ROLES) {
        expect(typeof hasCapability(role, capability)).toBe("boolean");
      }
    }
  });

  it("cannot be mutated after application startup", () => {
    expect(Object.isFrozen(PERMISSION_MATRIX)).toBe(true);

    for (const capability of CAPABILITIES) {
      expect(Object.isFrozen(PERMISSION_MATRIX[capability])).toBe(true);
    }
  });

  it("reserves structural and audit powers for the super admin", () => {
    expect(hasCapability("SUPER_ADMIN", "DEPARTMENT_STRUCTURE_MANAGE")).toBe(
      true,
    );
    expect(hasCapability("OPERATIONS_ADMIN", "DEPARTMENT_STRUCTURE_MANAGE")).toBe(
      false,
    );
    expect(hasCapability("SUPER_ADMIN", "AUDIT_LOG_VIEW")).toBe(true);
    expect(hasCapability("OPERATIONS_ADMIN", "AUDIT_LOG_VIEW")).toBe(false);
  });

  it("grants every defined capability to the super admin", () => {
    for (const capability of CAPABILITIES) {
      expect(hasCapability("SUPER_ADMIN", capability)).toBe(true);
    }
  });

  it("allows operations admins to view but not rewrite business model originals", () => {
    expect(hasCapability("OPERATIONS_ADMIN", "BUSINESS_MODEL_VIEW")).toBe(true);
    expect(hasCapability("OPERATIONS_ADMIN", "BUSINESS_MODEL_MANAGE")).toBe(false);
    expect(hasCapability("OPERATIONS_ADMIN", "EXECUTION_SUGGESTION_CREATE")).toBe(
      true,
    );
  });

  it("keeps employees out of administrative and assignment capabilities", () => {
    expect(hasCapability("EMPLOYEE", "ACCOUNT_MANAGE")).toBe(false);
    expect(hasCapability("EMPLOYEE", "DEPARTMENT_WORK_MANAGE")).toBe(false);
    expect(hasCapability("EMPLOYEE", "BUSINESS_MODEL_MANAGE")).toBe(false);
    expect(hasCapability("EMPLOYEE", "PROJECT_MEMBER_MANAGE")).toBe(false);
    expect(hasCapability("EMPLOYEE", "TASK_ASSIGN")).toBe(false);
    expect(hasCapability("EMPLOYEE", "TASK_REVIEW")).toBe(false);
    expect(hasCapability("EMPLOYEE", "AUDIT_LOG_VIEW")).toBe(false);
  });
});

describe("account administration scope", () => {
  it("allows the super admin to administer every role", () => {
    for (const targetRole of ROLES) {
      expect(canAdministerAccount(superAdmin, targetRole)).toBe(true);
    }
  });

  it("allows operations admins to administer all roles except super admins", () => {
    expect(canAdministerAccount(operationsAdmin, "OPERATIONS_ADMIN")).toBe(true);
    expect(canAdministerAccount(operationsAdmin, "DEPARTMENT_MANAGER")).toBe(true);
    expect(canAdministerAccount(operationsAdmin, "EMPLOYEE")).toBe(true);
    expect(canAdministerAccount(operationsAdmin, "SUPER_ADMIN")).toBe(false);
  });

  it("denies account administration to department managers and employees", () => {
    expect(canAdministerAccount(customerServiceManager, "EMPLOYEE")).toBe(false);
    expect(canAdministerAccount(employee, "EMPLOYEE")).toBe(false);
  });
});

describe("department scope", () => {
  it("allows operations admins to manage work across departments", () => {
    expect(canManageDepartmentWork(operationsAdmin, "customer-service")).toBe(true);
    expect(canManageDepartmentWork(operationsAdmin, "warehouse")).toBe(true);
  });

  it("limits department managers to their own department", () => {
    expect(
      canManageDepartmentWork(customerServiceManager, "customer-service"),
    ).toBe(true);
    expect(canManageDepartmentWork(customerServiceManager, "warehouse")).toBe(
      false,
    );
    expect(canViewDepartmentMembers(customerServiceManager, "warehouse")).toBe(
      false,
    );
  });

  it("denies management scope when an actor has no department", () => {
    expect(
      canManageDepartmentWork(
        { ...customerServiceManager, departmentId: null },
        "customer-service",
      ),
    ).toBe(false);
  });
});

describe("task assignment scope", () => {
  it("allows super and operations admins to assign across departments", () => {
    expect(canAssignTask(superAdmin, "warehouse")).toBe(true);
    expect(canAssignTask(operationsAdmin, "warehouse")).toBe(true);
  });

  it("limits department managers to assignees in their own department", () => {
    expect(canAssignTask(customerServiceManager, "customer-service")).toBe(true);
    expect(canAssignTask(customerServiceManager, "warehouse")).toBe(false);
  });

  it("never allows employees to assign tasks", () => {
    expect(canAssignTask(employee, "customer-service")).toBe(false);
  });
});

describe("conversation scope", () => {
  it("allows company administrators into every department conversation", () => {
    expect(canAccessDepartmentConversation(superAdmin, "warehouse")).toBe(true);
    expect(canAccessDepartmentConversation(operationsAdmin, "warehouse")).toBe(true);
  });

  it("limits other staff to their own department conversation", () => {
    expect(canAccessDepartmentConversation(employee, "customer-service")).toBe(true);
    expect(canAccessDepartmentConversation(employee, "warehouse")).toBe(false);
  });

  it("allows only super admins or active project members into a project conversation", () => {
    expect(canAccessProjectConversation(superAdmin, false)).toBe(true);
    expect(canAccessProjectConversation(operationsAdmin, false)).toBe(false);
    expect(canAccessProjectConversation(operationsAdmin, true)).toBe(true);
    expect(canAccessProjectConversation(employee, false)).toBe(false);
  });

  it("isolates the two internal operations team conversations", () => {
    expect(canAccessOperationsTeamConversation(superAdmin, "operations", "TEAM_TWO")).toBe(true);
    expect(canAccessOperationsTeamConversation(operationsAdmin, "operations", "TEAM_ONE")).toBe(true);
    expect(canAccessOperationsTeamConversation(operationsAdmin, "operations", "TEAM_TWO")).toBe(false);
    expect(canAccessOperationsTeamConversation(employee, "operations", "TEAM_ONE")).toBe(false);
  });
});
