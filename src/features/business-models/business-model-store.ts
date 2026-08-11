import type { PrismaClient } from "@/generated/prisma/client";
import type { BusinessModelStatus as PrismaBusinessModelStatus } from "@/generated/prisma/enums";
import {
  assertBusinessModelTransition,
  BusinessModelManagementError,
  type BusinessModelInput,
  type BusinessModelStatus,
} from "@/features/business-models/business-model-management";
import { hasCapability } from "@/lib/authz/permissions";
import type { Actor } from "@/lib/authz/types";

export class BusinessModelStoreError extends Error {
  constructor(
    public readonly code:
      | "BUSINESS_MODEL_NOT_FOUND"
      | "BUSINESS_MODEL_NOT_EDITABLE"
      | "BUSINESS_MODEL_CONFLICT",
  ) {
    super(code);
    this.name = "BusinessModelStoreError";
  }
}

export type BusinessModelListInput = {
  page: number;
  pageSize: number;
  query: string;
  category: string;
  tag: string;
  keyword: string;
  includeDeleted: boolean;
};

export function createPrismaBusinessModelStore(database: PrismaClient) {
  return {
    async create(actor: Actor, input: BusinessModelInput) {
      assertCanManage(actor);
      return database.$transaction(async (transaction) => {
        const created = await transaction.businessModel.create({
          data: { ...input, createdById: actor.id, updatedById: actor.id },
        });
        await transaction.businessModelEvent.create({
          data: {
            businessModelId: created.id,
            actorId: actor.id,
            type: "CREATED",
            revision: created.revision,
            snapshot: snapshotOf(created),
          },
        });
        return created;
      });
    },

    async update(
      actor: Actor,
      businessModelId: string,
      expectedRevision: number,
      input: BusinessModelInput,
    ) {
      assertCanManage(actor);
      return database.$transaction(async (transaction) => {
        const current = await transaction.businessModel.findUnique({
          where: { id: businessModelId },
        });
        if (!current || current.status === "DELETED") {
          throw new BusinessModelStoreError("BUSINESS_MODEL_NOT_FOUND");
        }
        if (current.status !== "ACTIVE") {
          throw new BusinessModelStoreError("BUSINESS_MODEL_NOT_EDITABLE");
        }

        const nextRevision = expectedRevision + 1;
        const updated = await transaction.businessModel.updateMany({
          where: { id: businessModelId, revision: expectedRevision, status: "ACTIVE" },
          data: { ...input, updatedById: actor.id, revision: nextRevision },
        });
        if (updated.count !== 1) {
          throw new BusinessModelStoreError("BUSINESS_MODEL_CONFLICT");
        }
        const record = await transaction.businessModel.findUniqueOrThrow({
          where: { id: businessModelId },
        });
        await transaction.businessModelEvent.create({
          data: {
            businessModelId,
            actorId: actor.id,
            type: "UPDATED",
            revision: record.revision,
            snapshot: snapshotOf(record),
          },
        });
        return record;
      });
    },

    async transition(
      actor: Actor,
      businessModelId: string,
      expectedRevision: number,
      nextStatus: BusinessModelStatus,
    ) {
      assertCanManage(actor);
      return database.$transaction(async (transaction) => {
        const current = await transaction.businessModel.findUnique({
          where: { id: businessModelId },
        });
        if (!current) throw new BusinessModelStoreError("BUSINESS_MODEL_NOT_FOUND");
        assertBusinessModelTransition(actor, current.status, nextStatus);

        const now = new Date();
        const nextRevision = expectedRevision + 1;
        const updated = await transaction.businessModel.updateMany({
          where: {
            id: businessModelId,
            revision: expectedRevision,
            status: current.status,
          },
          data: {
            status: nextStatus as PrismaBusinessModelStatus,
            revision: nextRevision,
            updatedById: actor.id,
            archivedAt:
              nextStatus === "ARCHIVED"
                ? now
                : nextStatus === "ACTIVE"
                  ? null
                  : current.archivedAt,
            deletedAt: nextStatus === "DELETED" ? now : current.deletedAt,
          },
        });
        if (updated.count !== 1) {
          throw new BusinessModelStoreError("BUSINESS_MODEL_CONFLICT");
        }
        const record = await transaction.businessModel.findUniqueOrThrow({
          where: { id: businessModelId },
        });
        await transaction.businessModelEvent.create({
          data: {
            businessModelId,
            actorId: actor.id,
            type:
              nextStatus === "ARCHIVED"
                ? "ARCHIVED"
                : nextStatus === "ACTIVE"
                  ? "RESTORED"
                  : "DELETED",
            revision: record.revision,
            snapshot: snapshotOf(record),
          },
        });
        return record;
      });
    },

    async list(actor: Actor, input: BusinessModelListInput) {
      assertCanView(actor);
      const page = Math.max(1, input.page);
      const pageSize = Math.min(50, Math.max(1, input.pageSize));
      const query = input.query.trim().slice(0, 100);
      const category = input.category.trim().slice(0, 100);
      const tag = input.tag.trim().slice(0, 30);
      const keyword = input.keyword.trim().slice(0, 30);
      const where = {
        status:
          input.includeDeleted && actor.role === "SUPER_ADMIN"
            ? undefined
            : { not: "DELETED" as const },
        ...(category ? { category } : {}),
        ...(tag ? { tags: { has: tag } } : {}),
        ...(keyword ? { keywords: { has: keyword } } : {}),
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" as const } },
                { category: { contains: query, mode: "insensitive" as const } },
                { targetPlatform: { contains: query, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };
      const [totalItems, items] = await database.$transaction([
        database.businessModel.count({ where }),
        database.businessModel.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            createdBy: { select: { id: true, name: true } },
            updatedBy: { select: { id: true, name: true } },
          },
        }),
      ]);
      return {
        items,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        },
      };
    },

    async get(actor: Actor, businessModelId: string) {
      assertCanView(actor);
      const record = await database.businessModel.findFirst({
        where: {
          id: businessModelId,
          ...(actor.role === "SUPER_ADMIN" ? {} : { status: { not: "DELETED" } }),
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
        },
      });
      if (!record) throw new BusinessModelStoreError("BUSINESS_MODEL_NOT_FOUND");
      const events =
        actor.role === "SUPER_ADMIN"
          ? await database.businessModelEvent.findMany({
              where: { businessModelId },
              orderBy: { revision: "desc" },
              select: {
                id: true,
                type: true,
                revision: true,
                createdAt: true,
                actor: { select: { id: true, name: true } },
              },
            })
          : [];
      return { ...record, events };
    },

    async facets(actor: Actor) {
      assertCanView(actor);
      const records = await database.businessModel.findMany({
        where: { status: { not: "DELETED" } },
        select: { category: true, tags: true, keywords: true },
      });
      return {
        categories: [...new Set(records.map(({ category }) => category))].sort(),
        tags: [...new Set(records.flatMap(({ tags }) => tags))].sort(),
        keywords: [...new Set(records.flatMap(({ keywords }) => keywords))].sort(),
      };
    },
  };
}

function assertCanManage(actor: Actor) {
  if (!hasCapability(actor.role, "BUSINESS_MODEL_MANAGE")) {
    throw new BusinessModelManagementError("BUSINESS_MODEL_OPERATION_FORBIDDEN");
  }
}

function assertCanView(actor: Actor) {
  if (!hasCapability(actor.role, "BUSINESS_MODEL_VIEW")) {
    throw new BusinessModelManagementError("BUSINESS_MODEL_OPERATION_FORBIDDEN");
  }
}

function snapshotOf(record: {
  title: string;
  category: string;
  targetPlatform: string;
  opportunity: string;
  businessLogic: string;
  executionPlan: string;
  costAssumptions: string;
  revenueAssumptions: string;
  risks: string;
  tags: string[];
  keywords: string[];
  status: PrismaBusinessModelStatus;
  revision: number;
}) {
  return {
    title: record.title,
    category: record.category,
    targetPlatform: record.targetPlatform,
    opportunity: record.opportunity,
    businessLogic: record.businessLogic,
    executionPlan: record.executionPlan,
    costAssumptions: record.costAssumptions,
    revenueAssumptions: record.revenueAssumptions,
    risks: record.risks,
    tags: record.tags,
    keywords: record.keywords,
    status: record.status,
    revision: record.revision,
  };
}
