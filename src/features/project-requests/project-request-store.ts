import type { PrismaClient } from "@/generated/prisma/client";
import { hasCapability } from "@/lib/authz/permissions";
import type { Actor } from "@/lib/authz/types";
import {
  assertProjectRequestReview,
  prepareExecutionSuggestionInput,
  prepareProjectRequestInput,
  ProjectRequestManagementError,
  type ExecutionSuggestionInput,
  type ProjectRequestDecision,
  type ProjectRequestInput,
} from "@/features/project-requests/project-request-management";

export class ProjectRequestStoreError extends Error {
  constructor(
    public readonly code:
      | "BUSINESS_MODEL_NOT_ACTIONABLE"
      | "EXECUTION_SUGGESTION_NOT_FOUND"
      | "PROJECT_REQUEST_ALREADY_EXISTS"
      | "PROJECT_REQUEST_NOT_FOUND"
      | "PROJECT_REQUEST_ALREADY_REVIEWED"
      | "PROJECT_REQUEST_CONFLICT"
      | "PROJECT_REQUEST_VIEW_FORBIDDEN",
  ) {
    super(code);
    this.name = "ProjectRequestStoreError";
  }
}

export function createPrismaProjectRequestStore(database: PrismaClient) {
  return {
    async createSuggestion(actor: Actor, input: ExecutionSuggestionInput) {
      const validated = prepareExecutionSuggestionInput(actor, input);
      const model = await database.businessModel.findFirst({
        where: { id: validated.businessModelId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!model) throw new ProjectRequestStoreError("BUSINESS_MODEL_NOT_ACTIONABLE");
      return database.executionSuggestion.create({
        data: { ...validated, authorId: actor.id },
      });
    },

    async createRequest(actor: Actor, input: ProjectRequestInput) {
      const validated = prepareProjectRequestInput(actor, input);
      return database.$transaction(async (transaction) => {
        const suggestion = await transaction.executionSuggestion.findFirst({
          where: {
            id: validated.suggestionId,
            businessModelId: validated.businessModelId,
            authorId: actor.id,
            businessModel: { status: "ACTIVE" },
          },
          select: { id: true },
        });
        if (!suggestion) {
          throw new ProjectRequestStoreError("EXECUTION_SUGGESTION_NOT_FOUND");
        }
        const existing = await transaction.projectRequest.findUnique({
          where: { suggestionId: validated.suggestionId },
          select: { id: true },
        });
        if (existing) throw new ProjectRequestStoreError("PROJECT_REQUEST_ALREADY_EXISTS");

        const created = await transaction.projectRequest.create({
          data: { ...validated, requestedById: actor.id },
        });
        await transaction.projectRequestEvent.create({
          data: {
            requestId: created.id,
            actorId: actor.id,
            type: "SUBMITTED",
            version: created.version,
          },
        });
        return created;
      });
    },

    async review(
      actor: Actor,
      requestId: string,
      expectedVersion: number,
      decision: ProjectRequestDecision,
      rawRejectionReason: string,
    ) {
      return database.$transaction(async (transaction) => {
        const current = await transaction.projectRequest.findUnique({
          where: { id: requestId },
        });
        if (!current) throw new ProjectRequestStoreError("PROJECT_REQUEST_NOT_FOUND");

        let review;
        try {
          review = assertProjectRequestReview(
            actor,
            current.status,
            decision,
            rawRejectionReason,
          );
        } catch (error) {
          if (
            error instanceof ProjectRequestManagementError &&
            error.code === "PROJECT_REQUEST_ALREADY_REVIEWED"
          ) {
            throw new ProjectRequestStoreError("PROJECT_REQUEST_ALREADY_REVIEWED");
          }
          throw error;
        }

        const nextVersion = expectedVersion + 1;
        const reviewedAt = new Date();
        const updated = await transaction.projectRequest.updateMany({
          where: { id: requestId, status: "PENDING", version: expectedVersion },
          data: {
            status: review.decision,
            rejectionReason: review.rejectionReason,
            reviewedById: actor.id,
            reviewedAt,
            version: nextVersion,
          },
        });
        if (updated.count !== 1) {
          const latest = await transaction.projectRequest.findUnique({
            where: { id: requestId },
            select: { status: true },
          });
          if (latest?.status !== "PENDING") {
            throw new ProjectRequestStoreError("PROJECT_REQUEST_ALREADY_REVIEWED");
          }
          throw new ProjectRequestStoreError("PROJECT_REQUEST_CONFLICT");
        }

        const record = await transaction.projectRequest.findUniqueOrThrow({
          where: { id: requestId },
        });
        await transaction.projectRequestEvent.create({
          data: {
            requestId,
            actorId: actor.id,
            type: review.decision,
            version: nextVersion,
            note: review.rejectionReason,
          },
        });
        await transaction.notification.create({
          data: {
            recipientId: record.requestedById,
            type:
              review.decision === "APPROVED"
                ? "PROJECT_REQUEST_APPROVED"
                : "PROJECT_REQUEST_REJECTED",
            title:
              review.decision === "APPROVED" ? "立项申请已批准" : "立项申请已拒绝",
            message:
              review.rejectionReason ?? "申请已通过，等待最高管理员在下一阶段创建项目。",
            resourceId: record.id,
          },
        });
        return record;
      });
    },

    async getBusinessModelContext(actor: Actor, businessModelId: string) {
      assertCanView(actor);
      const [suggestions, requests] = await database.$transaction([
        database.executionSuggestion.findMany({
          where: { businessModelId },
          orderBy: { createdAt: "desc" },
          take: 100,
          include: {
            author: { select: { id: true, name: true } },
            projectRequest: {
              select: { id: true, status: true, requestedById: true },
            },
          },
        }),
        database.projectRequest.findMany({
          where: {
            businessModelId,
            ...(hasCapability(actor.role, "PROJECT_REQUEST_REVIEW")
              ? {}
              : { requestedById: actor.id }),
          },
          orderBy: { createdAt: "desc" },
          take: 100,
          include: {
            requestedBy: { select: { id: true, name: true } },
            reviewedBy: { select: { id: true, name: true } },
          },
        }),
      ]);
      return { suggestions, requests };
    },

    async listRequests(actor: Actor, status?: "PENDING" | "APPROVED" | "REJECTED") {
      if (!hasCapability(actor.role, "PROJECT_REQUEST_REVIEW")) {
        throw new ProjectRequestStoreError("PROJECT_REQUEST_VIEW_FORBIDDEN");
      }
      return database.projectRequest.findMany({
        where: status ? { status } : undefined,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 100,
        include: {
          businessModel: { select: { id: true, title: true, category: true } },
          suggestion: { select: { content: true } },
          requestedBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } },
          project: { select: { id: true, name: true, status: true } },
        },
      });
    },
  };
}

function assertCanView(actor: Actor) {
  if (!hasCapability(actor.role, "BUSINESS_MODEL_VIEW")) {
    throw new ProjectRequestStoreError("PROJECT_REQUEST_VIEW_FORBIDDEN");
  }
}
