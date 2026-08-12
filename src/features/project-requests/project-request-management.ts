import { z } from "zod";

import { hasCapability } from "@/lib/authz/permissions";
import type { Actor } from "@/lib/authz/types";

export const PROJECT_REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ProjectRequestStatus = (typeof PROJECT_REQUEST_STATUSES)[number];
export const PROJECT_REQUEST_DECISIONS = ["APPROVED", "REJECTED"] as const;
export type ProjectRequestDecision = (typeof PROJECT_REQUEST_DECISIONS)[number];

const executionSuggestionSchema = z.object({
  businessModelId: z.uuid(),
  content: z.string().trim().min(2).max(10_000),
});

const projectRequestSchema = z.object({
  businessModelId: z.uuid(),
  suggestionId: z.uuid(),
  proposedName: z.string().trim().min(2).max(200),
  objective: z.string().trim().min(2).max(10_000),
});

const rejectionReasonSchema = z.string().trim().min(2).max(2_000);

export type ExecutionSuggestionInput = z.infer<typeof executionSuggestionSchema>;
export type ProjectRequestInput = z.infer<typeof projectRequestSchema>;

export class ProjectRequestManagementError extends Error {
  constructor(
    public readonly code:
      | "INVALID_EXECUTION_SUGGESTION"
      | "EXECUTION_SUGGESTION_FORBIDDEN"
      | "INVALID_PROJECT_REQUEST"
      | "PROJECT_REQUEST_CREATE_FORBIDDEN"
      | "PROJECT_REQUEST_REVIEW_FORBIDDEN"
      | "PROJECT_REQUEST_REJECTION_REASON_REQUIRED"
      | "PROJECT_REQUEST_ALREADY_REVIEWED",
  ) {
    super(code);
    this.name = "ProjectRequestManagementError";
  }
}

export function prepareExecutionSuggestionInput(actor: Actor, input: unknown) {
  if (
    actor.role === "SUPER_ADMIN" ||
    !hasCapability(actor.role, "EXECUTION_SUGGESTION_CREATE")
  ) {
    throw new ProjectRequestManagementError("EXECUTION_SUGGESTION_FORBIDDEN");
  }
  const parsed = executionSuggestionSchema.safeParse(input);
  if (!parsed.success) {
    throw new ProjectRequestManagementError("INVALID_EXECUTION_SUGGESTION");
  }
  return parsed.data;
}

export function prepareProjectRequestInput(actor: Actor, input: unknown) {
  if (
    actor.role === "SUPER_ADMIN" ||
    !hasCapability(actor.role, "PROJECT_REQUEST_CREATE")
  ) {
    throw new ProjectRequestManagementError("PROJECT_REQUEST_CREATE_FORBIDDEN");
  }
  const parsed = projectRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new ProjectRequestManagementError("INVALID_PROJECT_REQUEST");
  }
  return parsed.data;
}

export function assertProjectRequestReview(
  actor: Actor,
  currentStatus: ProjectRequestStatus,
  decision: ProjectRequestDecision,
  rawRejectionReason: string,
) {
  if (!hasCapability(actor.role, "PROJECT_REQUEST_REVIEW")) {
    throw new ProjectRequestManagementError("PROJECT_REQUEST_REVIEW_FORBIDDEN");
  }
  if (currentStatus !== "PENDING") {
    throw new ProjectRequestManagementError("PROJECT_REQUEST_ALREADY_REVIEWED");
  }
  if (decision === "APPROVED") {
    return { decision, rejectionReason: null } as const;
  }
  const reason = rejectionReasonSchema.safeParse(rawRejectionReason);
  if (!reason.success) {
    throw new ProjectRequestManagementError("PROJECT_REQUEST_REJECTION_REASON_REQUIRED");
  }
  return { decision, rejectionReason: reason.data } as const;
}
