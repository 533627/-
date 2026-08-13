import { describe, expect, it } from "vitest";

import {
  assertAccountStatusChange,
  prepareAccountCreation,
  preparePasswordReset,
  prepareUsernameChange,
} from "@/features/accounts/account-management";

const operationsDepartmentId = "00000000-0000-4000-8000-000000000001";
const generatedPassword = "generated-password-with-enough-entropy";
const superAdmin = {
  id: "owner-1",
  role: "SUPER_ADMIN",
  departmentId: null,
} as const;
const operationsAdmin = {
  id: "ops-1",
  role: "OPERATIONS_ADMIN",
  departmentId: operationsDepartmentId,
} as const;

describe("prepareAccountCreation", () => {
  it("normalizes an employee account and returns the password only with the result", async () => {
    const result = await prepareAccountCreation(
      superAdmin,
      {
        name: "  客服小林  ",
        username: "  Service.Lin  ",
        role: "EMPLOYEE",
        departmentId: operationsDepartmentId,
        isOperationsDepartment: false,
        operationsTeam: null,
      },
      dependencies(),
    );

    expect(result).toEqual({
      account: {
        name: "客服小林",
        username: "service.lin",
        email: "service.lin@internal.invalid",
        role: "EMPLOYEE",
        departmentId: operationsDepartmentId,
        operationsTeam: null,
        passwordHash: "stored-password-hash",
      },
      password: generatedPassword,
    });
    expect(result.account).not.toHaveProperty("password");
  });

  it("prevents an operations administrator from creating a highest administrator", async () => {
    await expect(
      prepareAccountCreation(
        operationsAdmin,
        {
          name: "另一位老板",
          username: "other.owner",
          role: "SUPER_ADMIN",
          departmentId: null,
          isOperationsDepartment: false,
          operationsTeam: null,
        },
        dependencies(),
      ),
    ).rejects.toMatchObject({ code: "ACCOUNT_OPERATION_FORBIDDEN" });
  });

  it("requires every non-super-admin account to belong to a department", async () => {
    await expect(
      prepareAccountCreation(
        superAdmin,
        {
          name: "无部门员工",
          username: "missing.department",
          role: "EMPLOYEE",
          departmentId: null,
          isOperationsDepartment: false,
          operationsTeam: null,
        },
        dependencies(),
      ),
    ).rejects.toMatchObject({ code: "DEPARTMENT_REQUIRED" });
  });

  it("rejects invalid usernames before password hashing", async () => {
    let didHash = false;

    await expect(
      prepareAccountCreation(
        superAdmin,
        {
          name: "无效账号",
          username: "中文账号",
          role: "EMPLOYEE",
          departmentId: operationsDepartmentId,
          isOperationsDepartment: false,
          operationsTeam: null,
        },
        {
          generatePassword: () => generatedPassword,
          hashPassword: async () => {
            didHash = true;
            return "stored-password-hash";
          },
        },
      ),
    ).rejects.toMatchObject({ code: "INVALID_ACCOUNT_INPUT" });
    expect(didHash).toBe(false);
  });

  it("requires an operations team for every operations department account", async () => {
    await expect(
      prepareAccountCreation(
        superAdmin,
        {
          name: "运营新人",
          username: "ops.new",
          role: "EMPLOYEE",
          departmentId: operationsDepartmentId,
          isOperationsDepartment: true,
          operationsTeam: null,
        },
        dependencies(),
      ),
    ).rejects.toMatchObject({ code: "OPERATIONS_TEAM_REQUIRED" });

    await expect(
      prepareAccountCreation(
        superAdmin,
        {
          name: "运营二组新人",
          username: "ops.team.two",
          role: "EMPLOYEE",
          departmentId: operationsDepartmentId,
          isOperationsDepartment: true,
          operationsTeam: "TEAM_TWO",
        },
        dependencies(),
      ),
    ).resolves.toMatchObject({ account: { operationsTeam: "TEAM_TWO" } });
  });
});

describe("account mutations", () => {
  it("normalizes a managed username change and keeps the internal email in sync", () => {
    expect(
      prepareUsernameChange(superAdmin, {
        id: "employee-1",
        role: "EMPLOYEE",
        isActive: true,
      }, "  New.Operator  "),
    ).toEqual({
      username: "new.operator",
      email: "new.operator@internal.invalid",
    });
  });

  it("prevents operations administrators from renaming highest administrators", () => {
    expect(() =>
      prepareUsernameChange(
        operationsAdmin,
        { id: "owner-2", role: "SUPER_ADMIN", isActive: true },
        "new.owner",
      ),
    ).toThrowError(expect.objectContaining({ code: "ACCOUNT_OPERATION_FORBIDDEN" }));
  });

  it("prevents an administrator from deactivating their own account", () => {
    expect(() =>
      assertAccountStatusChange(
        superAdmin,
        { id: superAdmin.id, role: "SUPER_ADMIN", isActive: true },
        false,
      ),
    ).toThrowError(expect.objectContaining({ code: "SELF_DEACTIVATION" }));
  });

  it("prevents operations administrators from mutating highest administrators", async () => {
    const target = { id: "owner-2", role: "SUPER_ADMIN", isActive: true } as const;

    expect(() =>
      assertAccountStatusChange(operationsAdmin, target, false),
    ).toThrowError(
      expect.objectContaining({ code: "ACCOUNT_OPERATION_FORBIDDEN" }),
    );
    await expect(
      preparePasswordReset(operationsAdmin, target, dependencies()),
    ).rejects.toMatchObject({ code: "ACCOUNT_OPERATION_FORBIDDEN" });
  });

  it("returns a new password separately from the password update command", async () => {
    const result = await preparePasswordReset(
      superAdmin,
      { id: "employee-1", role: "EMPLOYEE", isActive: true },
      dependencies(),
    );

    expect(result).toEqual({
      password: generatedPassword,
      passwordHash: "stored-password-hash",
    });
  });
});

function dependencies() {
  return {
    generatePassword: () => generatedPassword,
    hashPassword: async () => "stored-password-hash",
  };
}
