import {
  CAPABILITIES,
  ROLES,
  type Actor,
  type Capability,
  type Role,
  type OperationsTeam,
} from "@/lib/authz/types";

type PermissionMatrix = Readonly<
  Record<Capability, Readonly<Record<Role, boolean>>>
>;

const ROLE_CAPABILITIES = {
  SUPER_ADMIN: CAPABILITIES,
  OPERATIONS_ADMIN: [
    "ACCOUNT_MANAGE",
    "DEPARTMENT_WORK_MANAGE",
    "DEPARTMENT_MEMBERS_VIEW",
    "BUSINESS_MODEL_VIEW",
    "EXECUTION_SUGGESTION_CREATE",
    "PROJECT_REQUEST_CREATE",
    "PROJECT_VIEW",
    "TASK_ASSIGN",
    "TASK_EXECUTE",
    "TASK_REVIEW",
    "DEPARTMENT_CONVERSATION_ACCESS",
    "PROJECT_CONVERSATION_ACCESS",
    "DASHBOARD_VIEW",
  ],
  DEPARTMENT_MANAGER: [
    "DEPARTMENT_WORK_MANAGE",
    "DEPARTMENT_MEMBERS_VIEW",
    "PROJECT_VIEW",
    "TASK_ASSIGN",
    "TASK_EXECUTE",
    "TASK_REVIEW",
    "DEPARTMENT_CONVERSATION_ACCESS",
    "PROJECT_CONVERSATION_ACCESS",
    "DASHBOARD_VIEW",
  ],
  EMPLOYEE: [
    "PROJECT_VIEW",
    "TASK_EXECUTE",
    "DEPARTMENT_CONVERSATION_ACCESS",
    "PROJECT_CONVERSATION_ACCESS",
    "DASHBOARD_VIEW",
  ],
} as const satisfies Record<Role, readonly Capability[]>;

export const PERMISSION_MATRIX = Object.freeze(
  Object.fromEntries(
    CAPABILITIES.map((capability) => [
      capability,
      Object.freeze(
        Object.fromEntries(
          ROLES.map((role) => [
            role,
            ROLE_CAPABILITIES[role].some(
              (allowedCapability) => allowedCapability === capability,
            ),
          ]),
        ),
      ),
    ]),
  ),
) as PermissionMatrix;

export function hasCapability(role: Role, capability: Capability) {
  return PERMISSION_MATRIX[capability][role];
}

export function canAdministerAccount(actor: Actor, targetRole: Role) {
  if (!hasCapability(actor.role, "ACCOUNT_MANAGE")) {
    return false;
  }

  return actor.role === "SUPER_ADMIN" || targetRole !== "SUPER_ADMIN";
}

export function canManageDepartmentWork(
  actor: Actor,
  targetDepartmentId: string,
) {
  return hasDepartmentScope(
    actor,
    targetDepartmentId,
    "DEPARTMENT_WORK_MANAGE",
  );
}

export function canViewDepartmentMembers(
  actor: Actor,
  targetDepartmentId: string,
) {
  return hasDepartmentScope(
    actor,
    targetDepartmentId,
    "DEPARTMENT_MEMBERS_VIEW",
  );
}

export function canAssignTask(actor: Actor, assigneeDepartmentId: string) {
  return hasDepartmentScope(actor, assigneeDepartmentId, "TASK_ASSIGN");
}

export function canAssignOperationsTeamTask(
  actor: Actor,
  assigneeDepartmentId: string,
  assigneeOperationsTeam: OperationsTeam | null,
) {
  if (!hasCapability(actor.role, "TASK_ASSIGN")) return false;
  if (actor.role === "SUPER_ADMIN") return true;
  if (actor.role === "OPERATIONS_ADMIN") {
    return actor.departmentId === assigneeDepartmentId
      && actor.operationsTeam !== null
      && actor.operationsTeam !== undefined
      && actor.operationsTeam === assigneeOperationsTeam;
  }
  return actor.departmentId !== null && actor.departmentId === assigneeDepartmentId;
}

export function canAccessDepartmentConversation(
  actor: Actor,
  targetDepartmentId: string,
) {
  return hasDepartmentScope(
    actor,
    targetDepartmentId,
    "DEPARTMENT_CONVERSATION_ACCESS",
  );
}

export function canAccessProjectConversation(
  actor: Actor,
  isActiveProjectMember: boolean,
) {
  if (!hasCapability(actor.role, "PROJECT_CONVERSATION_ACCESS")) {
    return false;
  }

  return actor.role === "SUPER_ADMIN" || isActiveProjectMember;
}

export function canAccessOperationsTeamConversation(
  actor: Actor,
  operationsDepartmentId: string,
  targetTeam: OperationsTeam,
) {
  if (!hasCapability(actor.role, "DEPARTMENT_CONVERSATION_ACCESS")) return false;
  if (actor.role === "SUPER_ADMIN") return true;
  return actor.departmentId === operationsDepartmentId && actor.operationsTeam === targetTeam;
}

function hasDepartmentScope(
  actor: Actor,
  targetDepartmentId: string,
  capability: Capability,
) {
  if (!hasCapability(actor.role, capability)) {
    return false;
  }

  if (actor.role === "SUPER_ADMIN" || actor.role === "OPERATIONS_ADMIN") {
    return true;
  }

  return actor.departmentId !== null && actor.departmentId === targetDepartmentId;
}
