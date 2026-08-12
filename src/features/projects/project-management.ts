import type { ProjectStatus } from "@/generated/prisma/client";
import { z } from "zod";
import { hasCapability } from "@/lib/authz/permissions";
import type { Actor, Role } from "@/lib/authz/types";

export class ProjectManagementError extends Error {
  constructor(
    public readonly code:
      | "PROJECT_MANAGE_FORBIDDEN"
      | "PROJECT_VIEW_FORBIDDEN"
      | "PROJECT_NOT_FOUND"
      | "PROJECT_CONFLICT"
      | "PROJECT_STATUS_TRANSITION_INVALID"
      | "PROJECT_MEMBER_NOT_FOUND"
      | "PROJECT_MEMBER_INACTIVE"
      | "PROJECT_LEAD_REMOVAL_FORBIDDEN"
      | "PROJECT_DEPARTMENT_NOT_FOUND"
      | "PROJECT_DEPARTMENT_INACTIVE"
      | "PROJECT_INPUT_INVALID"
      | "PROJECT_SOURCE_NOT_ACTIONABLE",
  ) {
    super(code);
    this.name = "ProjectManagementError";
  }
}

const STATUS_TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  PREPARING: ["IN_PROGRESS", "ARCHIVED"],
  IN_PROGRESS: ["PAUSED", "COMPLETED"],
  PAUSED: ["IN_PROGRESS", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

const directProjectSchema = z.object({
  businessModelId: z.uuid(),
  leadId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(2).max(200),
  objective: z.string().trim().max(10_000).default(""),
});

export type DirectProjectInput = z.infer<typeof directProjectSchema>;

export function prepareDirectProjectInput(actor: Actor, input: unknown) {
  assertProjectManager(actor);
  const parsed = directProjectSchema.safeParse(input);
  if (!parsed.success) {
    throw new ProjectManagementError("PROJECT_INPUT_INVALID");
  }
  return parsed.data;
}

export function assertProjectManager(actor: Actor) {
  if (!hasCapability(actor.role, "PROJECT_MEMBER_MANAGE")) {
    throw new ProjectManagementError("PROJECT_MANAGE_FORBIDDEN");
  }
}

export function canAccessProject(role: Role, hasActiveMembership: boolean) {
  return role === "SUPER_ADMIN" || hasActiveMembership;
}

export function validateProjectStatusTransition(from: ProjectStatus, to: ProjectStatus) {
  if (!STATUS_TRANSITIONS[from].includes(to)) {
    throw new ProjectManagementError("PROJECT_STATUS_TRANSITION_INVALID");
  }
  return to;
}

export function nextProjectRevision(currentRevision: number) {
  return currentRevision + 1;
}
