import { Prisma, type PrismaClient, type ProjectEventType, type ProjectStatus } from "@/generated/prisma/client";
import type { Actor } from "@/lib/authz/types";
import {
  assertProjectManager,
  canAccessProject,
  nextProjectRevision,
  ProjectManagementError,
  validateProjectStatusTransition,
} from "@/features/projects/project-management";

const projectDetails = {
  sourceBusinessModel: { select: { id: true, title: true, category: true, targetPlatform: true } },
  sourceRequest: { select: { id: true, objective: true, suggestion: { select: { content: true } } } },
  lead: { select: { id: true, name: true, role: true, department: { select: { name: true } } } },
  members: {
    where: { removedAt: null },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    include: { user: { select: { id: true, name: true, role: true, department: { select: { name: true } } } } },
  },
  departments: {
    where: { removedAt: null },
    orderBy: { addedAt: "asc" },
    include: { department: { select: { id: true, name: true, code: true } } },
  },
  events: {
    orderBy: { revision: "desc" },
    take: 100,
    include: { actor: { select: { id: true, name: true } } },
  },
  conversation: { select: { id: true } },
} satisfies Prisma.ProjectInclude;

export function createPrismaProjectStore(database: PrismaClient) {
  return {
    async listProjects(actor: Actor, status?: ProjectStatus) {
      return database.project.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(actor.role === "SUPER_ADMIN"
            ? {}
            : { members: { some: { userId: actor.id, removedAt: null } } }),
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
        include: {
          lead: { select: { id: true, name: true } },
          sourceBusinessModel: { select: { id: true, title: true } },
          members: { where: { removedAt: null }, select: { id: true } },
          departments: {
            where: { removedAt: null },
            include: { department: { select: { id: true, name: true } } },
          },
        },
      });
    },

    async getProject(actor: Actor, projectId: string) {
      const project = await database.project.findFirst({
        where: {
          id: projectId,
          ...(actor.role === "SUPER_ADMIN"
            ? {}
            : { members: { some: { userId: actor.id, removedAt: null } } }),
        },
        include: projectDetails,
      });
      if (!project) {
        throw new ProjectManagementError(
          canAccessProject(actor.role, false) ? "PROJECT_NOT_FOUND" : "PROJECT_VIEW_FORBIDDEN",
        );
      }
      return project;
    },

    async getManagementOptions(actor: Actor) {
      assertProjectManager(actor);
      const [users, departments] = await database.$transaction([
        database.user.findMany({
          where: { isActive: true },
          orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
          take: 500,
          select: { id: true, name: true, role: true, department: { select: { name: true } } },
        }),
        database.department.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          take: 100,
          select: { id: true, name: true, code: true },
        }),
      ]);
      return { users, departments };
    },

    async addMember(actor: Actor, projectId: string, userId: string, expectedRevision: number) {
      assertProjectManager(actor);
      return database.$transaction(async (transaction) => {
        const user = await transaction.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true } });
        if (!user) throw new ProjectManagementError("PROJECT_MEMBER_INACTIVE");
        const current = await requireProject(transaction, projectId);
        const existing = await transaction.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId } },
        });
        if (existing && !existing.removedAt) return current;
        const revision = await claimRevision(transaction, projectId, expectedRevision);
        await transaction.projectMember.upsert({
          where: { projectId_userId: { projectId, userId } },
          create: { projectId, userId, addedById: actor.id },
          update: { role: "MEMBER", addedById: actor.id, joinedAt: new Date(), removedAt: null },
        });
        await createEvent(transaction, projectId, actor.id, "MEMBER_ADDED", revision, { userId });
        return transaction.project.findUniqueOrThrow({ where: { id: projectId } });
      });
    },

    async removeMember(actor: Actor, projectId: string, userId: string, expectedRevision: number) {
      assertProjectManager(actor);
      return database.$transaction(async (transaction) => {
        const current = await requireProject(transaction, projectId);
        if (current.leadId === userId) throw new ProjectManagementError("PROJECT_LEAD_REMOVAL_FORBIDDEN");
        const membership = await transaction.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId } },
        });
        if (!membership || membership.removedAt) throw new ProjectManagementError("PROJECT_MEMBER_NOT_FOUND");
        const revision = await claimRevision(transaction, projectId, expectedRevision);
        await transaction.projectMember.update({ where: { id: membership.id }, data: { removedAt: new Date() } });
        await createEvent(transaction, projectId, actor.id, "MEMBER_REMOVED", revision, { userId });
        return transaction.project.findUniqueOrThrow({ where: { id: projectId } });
      });
    },

    async changeLead(actor: Actor, projectId: string, userId: string, expectedRevision: number) {
      assertProjectManager(actor);
      return database.$transaction(async (transaction) => {
        const current = await requireProject(transaction, projectId);
        if (current.leadId === userId) return current;
        const nextLead = await transaction.projectMember.findFirst({
          where: { projectId, userId, removedAt: null, user: { isActive: true } },
          select: { id: true },
        });
        if (!nextLead) throw new ProjectManagementError("PROJECT_MEMBER_NOT_FOUND");
        const revision = await claimRevision(transaction, projectId, expectedRevision, { leadId: userId });
        await transaction.projectMember.updateMany({
          where: { projectId, userId: current.leadId, removedAt: null },
          data: { role: "MEMBER" },
        });
        await transaction.projectMember.update({ where: { id: nextLead.id }, data: { role: "LEAD" } });
        await createEvent(transaction, projectId, actor.id, "LEAD_CHANGED", revision, {
          fromUserId: current.leadId,
          toUserId: userId,
        });
        return transaction.project.findUniqueOrThrow({ where: { id: projectId } });
      });
    },

    async addDepartment(actor: Actor, projectId: string, departmentId: string, expectedRevision: number) {
      assertProjectManager(actor);
      return database.$transaction(async (transaction) => {
        const department = await transaction.department.findFirst({
          where: { id: departmentId, isActive: true }, select: { id: true },
        });
        if (!department) throw new ProjectManagementError("PROJECT_DEPARTMENT_INACTIVE");
        await requireProject(transaction, projectId);
        const existing = await transaction.projectDepartment.findUnique({
          where: { projectId_departmentId: { projectId, departmentId } },
        });
        if (existing && !existing.removedAt) return transaction.project.findUniqueOrThrow({ where: { id: projectId } });
        const revision = await claimRevision(transaction, projectId, expectedRevision);
        await transaction.projectDepartment.upsert({
          where: { projectId_departmentId: { projectId, departmentId } },
          create: { projectId, departmentId, addedById: actor.id },
          update: { addedById: actor.id, addedAt: new Date(), removedAt: null },
        });
        await createEvent(transaction, projectId, actor.id, "DEPARTMENT_ADDED", revision, { departmentId });
        return transaction.project.findUniqueOrThrow({ where: { id: projectId } });
      });
    },

    async removeDepartment(actor: Actor, projectId: string, departmentId: string, expectedRevision: number) {
      assertProjectManager(actor);
      return database.$transaction(async (transaction) => {
        await requireProject(transaction, projectId);
        const participant = await transaction.projectDepartment.findUnique({
          where: { projectId_departmentId: { projectId, departmentId } },
        });
        if (!participant || participant.removedAt) throw new ProjectManagementError("PROJECT_DEPARTMENT_NOT_FOUND");
        const revision = await claimRevision(transaction, projectId, expectedRevision);
        await transaction.projectDepartment.update({ where: { id: participant.id }, data: { removedAt: new Date() } });
        await createEvent(transaction, projectId, actor.id, "DEPARTMENT_REMOVED", revision, { departmentId });
        return transaction.project.findUniqueOrThrow({ where: { id: projectId } });
      });
    },

    async changeStatus(actor: Actor, projectId: string, status: ProjectStatus, expectedRevision: number) {
      assertProjectManager(actor);
      return database.$transaction(async (transaction) => {
        const current = await requireProject(transaction, projectId);
        const nextStatus = validateProjectStatusTransition(current.status, status);
        const revision = await claimRevision(transaction, projectId, expectedRevision, { status: nextStatus });
        await createEvent(transaction, projectId, actor.id, "STATUS_CHANGED", revision, {
          fromStatus: current.status,
          toStatus: nextStatus,
        });
        return transaction.project.findUniqueOrThrow({ where: { id: projectId } });
      });
    },
  };
}

async function requireProject(transaction: Prisma.TransactionClient, projectId: string) {
  const project = await transaction.project.findUnique({ where: { id: projectId } });
  if (!project) throw new ProjectManagementError("PROJECT_NOT_FOUND");
  return project;
}

async function claimRevision(
  transaction: Prisma.TransactionClient,
  projectId: string,
  expectedRevision: number,
  data: Partial<{ status: ProjectStatus; leadId: string }> = {},
) {
  const revision = nextProjectRevision(expectedRevision);
  const updated = await transaction.project.updateMany({
    where: { id: projectId, revision: expectedRevision },
    data: { ...data, revision },
  });
  if (updated.count !== 1) throw new ProjectManagementError("PROJECT_CONFLICT");
  return revision;
}

function createEvent(
  transaction: Prisma.TransactionClient,
  projectId: string,
  actorId: string,
  type: ProjectEventType,
  revision: number,
  details: Prisma.InputJsonObject,
) {
  return transaction.projectEvent.create({ data: { projectId, actorId, type, revision, details } });
}
