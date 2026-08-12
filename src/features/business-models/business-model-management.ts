import { z } from "zod";

import { hasCapability } from "@/lib/authz/permissions";
import type { Actor } from "@/lib/authz/types";

export const BUSINESS_MODEL_STATUSES = ["ACTIVE", "ARCHIVED", "DELETED"] as const;
export type BusinessModelStatus = (typeof BUSINESS_MODEL_STATUSES)[number];

const optionalLongText = z.string().trim().max(10_000).default("");
const optionalShortText = (max: number) => z.string().trim().max(max).default("");
const labelList = z
  .array(z.string().trim().min(1).max(30))
  .max(20)
  .transform((items) => [...new Set(items)]);

const businessModelInputSchema = z.object({
  title: z.string().trim().min(2).max(200),
  category: optionalShortText(100),
  targetPlatform: optionalShortText(100),
  opportunity: optionalLongText,
  businessLogic: optionalLongText,
  executionPlan: optionalLongText,
  costAssumptions: optionalLongText,
  revenueAssumptions: optionalLongText,
  risks: optionalLongText,
  tags: labelList,
  keywords: labelList,
});

export type BusinessModelInput = z.infer<typeof businessModelInputSchema>;

export class BusinessModelManagementError extends Error {
  constructor(
    public readonly code:
      | "INVALID_BUSINESS_MODEL_INPUT"
      | "BUSINESS_MODEL_OPERATION_FORBIDDEN"
      | "INVALID_BUSINESS_MODEL_TRANSITION",
  ) {
    super(code);
    this.name = "BusinessModelManagementError";
  }
}

export function prepareBusinessModelInput(actor: Actor, input: unknown) {
  assertCanManageBusinessModels(actor);
  const parsed = businessModelInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new BusinessModelManagementError("INVALID_BUSINESS_MODEL_INPUT");
  }
  return parsed.data;
}

export function assertBusinessModelTransition(
  actor: Actor,
  currentStatus: BusinessModelStatus,
  nextStatus: BusinessModelStatus,
) {
  assertCanManageBusinessModels(actor);
  const allowed =
    (currentStatus === "ACTIVE" && nextStatus === "ARCHIVED") ||
    (currentStatus === "ARCHIVED" && nextStatus === "ACTIVE") ||
    (currentStatus === "ARCHIVED" && nextStatus === "DELETED");
  if (!allowed) {
    throw new BusinessModelManagementError("INVALID_BUSINESS_MODEL_TRANSITION");
  }
}

function assertCanManageBusinessModels(actor: Actor) {
  if (!hasCapability(actor.role, "BUSINESS_MODEL_MANAGE")) {
    throw new BusinessModelManagementError("BUSINESS_MODEL_OPERATION_FORBIDDEN");
  }
}
