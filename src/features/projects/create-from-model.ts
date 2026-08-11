import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { hasCapability } from "@/lib/authz/permissions";
import type { Actor } from "@/lib/authz/types";

const MAX_TRANSACTION_ATTEMPTS = 3;

export class ProjectConversionError extends Error {
  constructor(
    public readonly code:
      | "PROJECT_CONVERSION_FORBIDDEN"
      | "PROJECT_REQUEST_NOT_APPROVED"
      | "PROJECT_CONVERSION_CONFLICT",
  ) {
    super(code);
    this.name = "ProjectConversionError";
  }
}

export async function createProjectFromApprovedRequest(
  database: PrismaClient,
  actor: Actor,
  requestId: string,
) {
  if (!hasCapability(actor.role, "PROJECT_MEMBER_MANAGE")) {
    throw new ProjectConversionError("PROJECT_CONVERSION_FORBIDDEN");
  }

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await database.$transaction(
        async (transaction) => {
          const existing = await transaction.project.findUnique({
            where: { sourceRequestId: requestId },
          });
          if (existing) return { project: existing, created: false as const };

          const request = await transaction.projectRequest.findUnique({
            where: { id: requestId },
            include: {
              requestedBy: { select: { id: true, departmentId: true } },
            },
          });
          if (!request || request.status !== "APPROVED") {
            throw new ProjectConversionError("PROJECT_REQUEST_NOT_APPROVED");
          }

          const project = await transaction.project.create({
            data: {
              name: request.proposedName,
              objective: request.objective,
              sourceBusinessModelId: request.businessModelId,
              sourceRequestId: request.id,
              leadId: request.requestedById,
              createdById: actor.id,
            },
          });
          await transaction.projectMember.createMany({
            data:
              actor.id === request.requestedById
                ? [{ projectId: project.id, userId: actor.id, role: "LEAD", addedById: actor.id }]
                : [
                    { projectId: project.id, userId: request.requestedById, role: "LEAD", addedById: actor.id },
                    { projectId: project.id, userId: actor.id, role: "MEMBER", addedById: actor.id },
                  ],
          });
          if (request.requestedBy.departmentId) {
            await transaction.projectDepartment.create({
              data: {
                projectId: project.id,
                departmentId: request.requestedBy.departmentId,
                addedById: actor.id,
              },
            });
          }
          await transaction.projectConversation.create({
            data: { projectId: project.id, createdById: actor.id },
          });
          await transaction.projectEvent.create({
            data: {
              projectId: project.id,
              actorId: actor.id,
              type: "CREATED",
              revision: project.revision,
              details: { sourceRequestId: request.id },
            },
          });
          return { project, created: true as const };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        if (attempt < MAX_TRANSACTION_ATTEMPTS) continue;
        throw new ProjectConversionError("PROJECT_CONVERSION_CONFLICT");
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await database.project.findUnique({
          where: { sourceRequestId: requestId },
        });
        if (existing) return { project: existing, created: false as const };
      }
      throw error;
    }
  }

  throw new ProjectConversionError("PROJECT_CONVERSION_CONFLICT");
}
