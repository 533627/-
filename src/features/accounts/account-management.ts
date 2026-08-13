import { hashPassword } from "better-auth/crypto";
import { z } from "zod";

import { generateTemporaryPassword } from "@/features/accounts/bootstrap-admin";
import { canAdministerAccount } from "@/lib/authz/permissions";
import { OPERATIONS_TEAMS, ROLES, type Actor, type Role } from "@/lib/authz/types";

const accountInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_.]+$/)
    .transform((username) => username.toLowerCase()),
  role: z.enum(ROLES),
  departmentId: z.uuid().nullable(),
  isOperationsDepartment: z.boolean(),
  operationsTeam: z.enum(OPERATIONS_TEAMS).nullable(),
});

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_.]+$/)
  .transform((username) => username.toLowerCase());

type PasswordDependencies = {
  generatePassword: () => string;
  hashPassword: (password: string) => Promise<string>;
};

export type ManagedAccountTarget = {
  id: string;
  role: Role;
  isActive: boolean;
};

export class AccountManagementError extends Error {
  constructor(
    public readonly code:
      | "INVALID_ACCOUNT_INPUT"
      | "DEPARTMENT_REQUIRED"
      | "OPERATIONS_TEAM_REQUIRED"
      | "ACCOUNT_OPERATION_FORBIDDEN"
      | "INVALID_GENERATED_PASSWORD"
      | "SELF_DEACTIVATION",
  ) {
    super(code);
    this.name = "AccountManagementError";
  }
}

export async function prepareAccountCreation(
  actor: Actor,
  input: unknown,
  dependencies: PasswordDependencies = {
    generatePassword: generateTemporaryPassword,
    hashPassword,
  },
) {
  const parsedInput = accountInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new AccountManagementError("INVALID_ACCOUNT_INPUT");
  }

  const { name, username, role } = parsedInput.data;
  if (!canAdministerAccount(actor, role)) {
    throw new AccountManagementError("ACCOUNT_OPERATION_FORBIDDEN");
  }

  const departmentId = role === "SUPER_ADMIN" ? null : parsedInput.data.departmentId;
  if (role !== "SUPER_ADMIN" && !departmentId) {
    throw new AccountManagementError("DEPARTMENT_REQUIRED");
  }
  const operationsTeam = role !== "SUPER_ADMIN" && parsedInput.data.isOperationsDepartment
    ? parsedInput.data.operationsTeam
    : null;
  if (parsedInput.data.isOperationsDepartment && !operationsTeam) {
    throw new AccountManagementError("OPERATIONS_TEAM_REQUIRED");
  }

  const password = dependencies.generatePassword();
  assertGeneratedPassword(password);

  return {
    account: {
      name,
      username,
      email: `${username}@internal.invalid`,
      role,
      departmentId,
      operationsTeam,
      passwordHash: await dependencies.hashPassword(password),
    },
    password,
  };
}

export async function preparePasswordReset(
  actor: Actor,
  target: ManagedAccountTarget,
  dependencies: PasswordDependencies = {
    generatePassword: generateTemporaryPassword,
    hashPassword,
  },
) {
  assertCanManageAccount(actor, target);
  const password = dependencies.generatePassword();
  assertGeneratedPassword(password);

  return {
    password,
    passwordHash: await dependencies.hashPassword(password),
  };
}

export function prepareUsernameChange(
  actor: Actor,
  target: ManagedAccountTarget,
  rawUsername: unknown,
) {
  assertCanManageAccount(actor, target);
  const parsed = usernameSchema.safeParse(rawUsername);
  if (!parsed.success) {
    throw new AccountManagementError("INVALID_ACCOUNT_INPUT");
  }
  return {
    username: parsed.data,
    email: `${parsed.data}@internal.invalid`,
  };
}

export function assertAccountStatusChange(
  actor: Actor,
  target: ManagedAccountTarget,
  nextIsActive: boolean,
) {
  assertCanManageAccount(actor, target);
  if (actor.id === target.id && !nextIsActive) {
    throw new AccountManagementError("SELF_DEACTIVATION");
  }
}

export function assertCanManageAccount(
  actor: Actor,
  target: ManagedAccountTarget,
) {
  if (!canAdministerAccount(actor, target.role)) {
    throw new AccountManagementError("ACCOUNT_OPERATION_FORBIDDEN");
  }
}

function assertGeneratedPassword(password: string) {
  if (password.length < 12 || password.length > 128) {
    throw new AccountManagementError("INVALID_GENERATED_PASSWORD");
  }
}
