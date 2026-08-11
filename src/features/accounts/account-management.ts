import { hashPassword } from "better-auth/crypto";
import { z } from "zod";

import { generateTemporaryPassword } from "@/features/accounts/bootstrap-admin";
import { canAdministerAccount } from "@/lib/authz/permissions";
import { ROLES, type Actor, type Role } from "@/lib/authz/types";

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
});

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

  const password = dependencies.generatePassword();
  assertGeneratedPassword(password);

  return {
    account: {
      name,
      username,
      email: `${username}@internal.invalid`,
      role,
      departmentId,
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
  assertCanManageTarget(actor, target);
  const password = dependencies.generatePassword();
  assertGeneratedPassword(password);

  return {
    password,
    passwordHash: await dependencies.hashPassword(password),
  };
}

export function assertAccountStatusChange(
  actor: Actor,
  target: ManagedAccountTarget,
  nextIsActive: boolean,
) {
  assertCanManageTarget(actor, target);
  if (actor.id === target.id && !nextIsActive) {
    throw new AccountManagementError("SELF_DEACTIVATION");
  }
}

function assertCanManageTarget(actor: Actor, target: ManagedAccountTarget) {
  if (!canAdministerAccount(actor, target.role)) {
    throw new AccountManagementError("ACCOUNT_OPERATION_FORBIDDEN");
  }
}

function assertGeneratedPassword(password: string) {
  if (password.length < 12 || password.length > 128) {
    throw new AccountManagementError("INVALID_GENERATED_PASSWORD");
  }
}
