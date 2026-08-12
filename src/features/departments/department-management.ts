import { z } from "zod";

import {
  canAdministerAccount,
  hasCapability,
} from "@/lib/authz/permissions";
import { OPERATIONS_TEAMS, type Actor, type OperationsTeam, type Role } from "@/lib/authz/types";

const departmentInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .transform((code) => code.replaceAll("-", "_").toUpperCase()),
  name: z.string().trim().min(2).max(100),
});

export type DepartmentMemberTarget = {
  id: string;
  role: Role;
  departmentId: string | null;
  operationsTeam?: OperationsTeam | null;
};

export class DepartmentManagementError extends Error {
  constructor(
    public readonly code:
      | "INVALID_DEPARTMENT_INPUT"
      | "DEPARTMENT_OPERATION_FORBIDDEN"
      | "MEMBER_OPERATION_FORBIDDEN"
      | "MEMBER_ALREADY_IN_DEPARTMENT"
      | "OPERATIONS_TEAM_REQUIRED"
  ) {
    super(code);
    this.name = "DepartmentManagementError";
  }
}

export function normalizeDestinationOperationsTeam(
  isOperationsDepartment: boolean,
  rawTeam: unknown,
): OperationsTeam | null {
  if (!isOperationsDepartment) return null;
  const parsed = z.enum(OPERATIONS_TEAMS).safeParse(rawTeam);
  if (!parsed.success) throw new DepartmentManagementError("OPERATIONS_TEAM_REQUIRED");
  return parsed.data;
}

export function prepareDepartmentCreation(actor: Actor, input: unknown) {
  if (!hasCapability(actor.role, "DEPARTMENT_STRUCTURE_MANAGE")) {
    throw new DepartmentManagementError("DEPARTMENT_OPERATION_FORBIDDEN");
  }

  const parsed = departmentInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new DepartmentManagementError("INVALID_DEPARTMENT_INPUT");
  }
  return parsed.data;
}

export function assertCanTransferMember(
  actor: Actor,
  target: DepartmentMemberTarget,
  destinationDepartmentId: string,
  destinationOperationsTeam: OperationsTeam | null = null,
) {
  if (
    !hasCapability(actor.role, "ACCOUNT_MANAGE") ||
    !canAdministerAccount(actor, target.role) ||
    target.role === "SUPER_ADMIN"
  ) {
    throw new DepartmentManagementError("MEMBER_OPERATION_FORBIDDEN");
  }
  if (
    target.departmentId === destinationDepartmentId &&
    (target.operationsTeam ?? null) === destinationOperationsTeam
  ) {
    throw new DepartmentManagementError("MEMBER_ALREADY_IN_DEPARTMENT");
  }
}
