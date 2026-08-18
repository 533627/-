export const ROLES = [
  "SUPER_ADMIN",
  "OPERATIONS_ADMIN",
  "DEPARTMENT_MANAGER",
  "EMPLOYEE",
] as const;

export type Role = (typeof ROLES)[number];

export const OPERATIONS_TEAMS = ["TEAM_ONE", "TEAM_TWO"] as const;
export type OperationsTeam = (typeof OPERATIONS_TEAMS)[number];

export const CAPABILITIES = [
  "ACCOUNT_MANAGE",
  "DEPARTMENT_STRUCTURE_MANAGE",
  "DEPARTMENT_WORK_MANAGE",
  "DEPARTMENT_MEMBERS_VIEW",
  "BUSINESS_MODEL_VIEW",
  "BUSINESS_MODEL_MANAGE",
  "EXECUTION_SUGGESTION_CREATE",
  "PROJECT_REQUEST_CREATE",
  "PROJECT_REQUEST_REVIEW",
  "PROJECT_VIEW",
  "PROJECT_MEMBER_MANAGE",
  "TASK_ASSIGN",
  "TASK_EXECUTE",
  "TASK_REVIEW",
  "DEPARTMENT_CONVERSATION_ACCESS",
  "PROJECT_CONVERSATION_ACCESS",
  "DASHBOARD_VIEW",
  "AUDIT_LOG_VIEW",
  "REFERENCE_STUDIO_UPDATE_MANAGE",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export type Actor = {
  id: string;
  role: Role;
  departmentId: string | null;
  operationsTeam?: OperationsTeam | null;
};
