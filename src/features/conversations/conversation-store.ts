import type { PrismaClient } from "@/generated/prisma/client";
import {
  canAccessDepartmentConversation,
  canAccessOperationsTeamConversation,
  canAccessProjectConversation,
} from "@/lib/authz/permissions";
import type { Actor, OperationsTeam } from "@/lib/authz/types";
import { prepareConversationMessage } from "@/features/conversations/conversation-management";

export class ConversationStoreError extends Error {
  constructor(public readonly code: "CONVERSATION_NOT_FOUND" | "CONVERSATION_FORBIDDEN") {
    super(code);
    this.name = "ConversationStoreError";
  }
}

export function createPrismaConversationStore(database: PrismaClient) {
  return {
    async list(actor: Actor) {
      const departments = await database.department.findMany({
        where: {
          isActive: true,
          ...(actor.role === "SUPER_ADMIN" || actor.role === "OPERATIONS_ADMIN"
            ? {}
            : { id: actor.departmentId ?? "00000000-0000-0000-0000-000000000000" }),
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, code: true },
      });
      const projects = await database.project.findMany({
        where: actor.role === "SUPER_ADMIN"
          ? {}
          : { members: { some: { userId: actor.id, removedAt: null } } },
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: { id: true, name: true, status: true, conversation: { select: { id: true } } },
      });
      const visibleDepartments: Array<{
        id: string;
        name: string;
        code: string;
        operationsTeam: OperationsTeam | null;
      }> = [];
      for (const department of departments) {
        if (department.code !== "OPERATIONS") {
          visibleDepartments.push({ ...department, operationsTeam: null });
          continue;
        }
        const teams: OperationsTeam[] = actor.role === "SUPER_ADMIN"
          ? ["TEAM_ONE", "TEAM_TWO"]
          : actor.operationsTeam
            ? [actor.operationsTeam]
            : [];
        visibleDepartments.push(...teams.map((operationsTeam) => ({
          ...department,
          name: operationsTeam === "TEAM_ONE" ? "运营一组" : "运营二组",
          operationsTeam,
        })));
      }
      return { departments: visibleDepartments, projects: projects.filter((project) => project.conversation) };
    },

    async getDepartment(actor: Actor, departmentId: string, operationsTeam: OperationsTeam | null = null) {
      const department = await database.department.findUnique({
        where: { id: departmentId },
        select: {
          id: true, name: true, code: true,
          messages: {
            where: { operationsTeam: departmentMessageTeam(operationsTeam) },
            orderBy: { createdAt: "desc" }, take: 100,
            select: { id: true, content: true, createdAt: true, authorId: true, author: { select: { id: true, name: true } } },
          },
        },
      });
      if (!department) throw new ConversationStoreError("CONVERSATION_NOT_FOUND");
      assertDepartmentConversationAccess(actor, department, operationsTeam);
      const name = department.code === "OPERATIONS"
        ? operationsTeam === "TEAM_ONE" ? "运营一组群" : "运营二组群"
        : `${department.name}群`;
      return { kind: "department" as const, id: department.id, operationsTeam, name, subtitle: "部门日常协作", messages: department.messages.reverse() };
    },

    async getProject(actor: Actor, projectId: string) {
      const project = await database.project.findUnique({
        where: { id: projectId },
        select: {
          id: true, name: true,
          members: { where: { userId: actor.id, removedAt: null }, select: { id: true } },
          conversation: {
            select: {
              id: true,
              messages: {
                orderBy: { createdAt: "desc" }, take: 100,
                select: { id: true, content: true, createdAt: true, authorId: true, author: { select: { id: true, name: true } } },
              },
            },
          },
        },
      });
      if (!project?.conversation) throw new ConversationStoreError("CONVERSATION_NOT_FOUND");
      if (!canAccessProjectConversation(actor, project.members.length > 0)) throw new ConversationStoreError("CONVERSATION_FORBIDDEN");
      return { kind: "project" as const, id: project.id, name: project.name, subtitle: "项目协作群", messages: project.conversation.messages.reverse() };
    },

    async sendDepartment(actor: Actor, departmentId: string, rawContent: unknown, operationsTeam: OperationsTeam | null = null) {
      const content = prepareConversationMessage(rawContent);
      const department = await database.department.findUnique({ where: { id: departmentId }, select: { id: true, code: true } });
      if (!department) throw new ConversationStoreError("CONVERSATION_NOT_FOUND");
      assertDepartmentConversationAccess(actor, department, operationsTeam);
      return database.departmentMessage.create({ data: { departmentId, authorId: actor.id, content, operationsTeam } });
    },

    async sendProject(actor: Actor, projectId: string, rawContent: unknown) {
      const conversation = await database.projectConversation.findUnique({
        where: { projectId },
        select: { id: true, project: { select: { members: { where: { userId: actor.id, removedAt: null }, select: { id: true } } } } },
      });
      if (!conversation) throw new ConversationStoreError("CONVERSATION_NOT_FOUND");
      if (!canAccessProjectConversation(actor, conversation.project.members.length > 0)) throw new ConversationStoreError("CONVERSATION_FORBIDDEN");
      const content = prepareConversationMessage(rawContent);
      return database.projectMessage.create({ data: { conversationId: conversation.id, authorId: actor.id, content } });
    },
  };
}

function departmentMessageTeam(operationsTeam: OperationsTeam | null) {
  return operationsTeam;
}

function assertDepartmentConversationAccess(
  actor: Actor,
  department: { id: string; code: string },
  operationsTeam: OperationsTeam | null,
) {
  const allowed = department.code === "OPERATIONS"
    ? operationsTeam !== null && canAccessOperationsTeamConversation(actor, department.id, operationsTeam)
    : operationsTeam === null && canAccessDepartmentConversation(actor, department.id);
  if (!allowed) throw new ConversationStoreError("CONVERSATION_FORBIDDEN");
}
