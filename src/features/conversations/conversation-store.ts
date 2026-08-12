import type { PrismaClient } from "@/generated/prisma/client";
import {
  canAccessDepartmentConversation,
  canAccessProjectConversation,
} from "@/lib/authz/permissions";
import type { Actor } from "@/lib/authz/types";
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
      return { departments, projects: projects.filter((project) => project.conversation) };
    },

    async getDepartment(actor: Actor, departmentId: string) {
      const department = await database.department.findUnique({
        where: { id: departmentId },
        select: {
          id: true, name: true, code: true,
          messages: {
            orderBy: { createdAt: "desc" }, take: 100,
            select: { id: true, content: true, createdAt: true, authorId: true, author: { select: { id: true, name: true } } },
          },
        },
      });
      if (!department) throw new ConversationStoreError("CONVERSATION_NOT_FOUND");
      if (!canAccessDepartmentConversation(actor, department.id)) throw new ConversationStoreError("CONVERSATION_FORBIDDEN");
      return { kind: "department" as const, id: department.id, name: `${department.name}群`, subtitle: "部门日常协作", messages: department.messages.reverse() };
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

    async sendDepartment(actor: Actor, departmentId: string, rawContent: unknown) {
      const content = prepareConversationMessage(rawContent);
      const department = await database.department.findUnique({ where: { id: departmentId }, select: { id: true } });
      if (!department) throw new ConversationStoreError("CONVERSATION_NOT_FOUND");
      if (!canAccessDepartmentConversation(actor, department.id)) throw new ConversationStoreError("CONVERSATION_FORBIDDEN");
      return database.departmentMessage.create({ data: { departmentId, authorId: actor.id, content } });
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
