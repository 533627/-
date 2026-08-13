import type { PrismaClient } from "@/generated/prisma/client";
import {
  canAccessDepartmentConversation,
  canAccessOperationsTeamConversation,
  canAccessProjectConversation,
} from "@/lib/authz/permissions";
import type { Actor, OperationsTeam } from "@/lib/authz/types";
import { prepareConversationMessage } from "@/features/conversations/conversation-management";
import { assertDirectMessageTarget } from "@/features/conversations/direct-message-management";

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
        where: {
          status: { not: "ARCHIVED" },
          sourceBusinessModel: { status: { not: "DELETED" } },
          ...(actor.role === "SUPER_ADMIN"
            ? {}
            : { members: { some: { userId: actor.id, removedAt: null } } }),
        },
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

    async listDirectContacts(actor: Actor) {
      return database.user.findMany({
        where: { id: { not: actor.id }, isActive: true },
        orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
        take: 500,
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          department: { select: { name: true } },
          receivedDirectMessages: {
            where: { senderId: actor.id },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
          sentDirectMessages: {
            where: { recipientId: actor.id, readAt: null },
            select: { id: true },
          },
        },
      });
    },

    async getDirect(actor: Actor, contactId: string) {
      const contact = await database.user.findUnique({
        where: { id: contactId },
        select: { id: true, name: true, username: true, isActive: true, department: { select: { name: true } } },
      });
      if (!contact) throw new ConversationStoreError("CONVERSATION_NOT_FOUND");
      try {
        assertDirectMessageTarget(actor.id, contact);
      } catch {
        throw new ConversationStoreError("CONVERSATION_FORBIDDEN");
      }
      const messages = await database.$transaction(async (transaction) => {
        await transaction.directMessage.updateMany({
          where: { senderId: contact.id, recipientId: actor.id, readAt: null },
          data: { readAt: new Date() },
        });
        await transaction.notification.updateMany({
          where: { recipientId: actor.id, type: "DIRECT_MESSAGE", resourceId: contact.id, isRead: false },
          data: { isRead: true, readAt: new Date() },
        });
        return transaction.directMessage.findMany({
          where: {
            OR: [
              { senderId: actor.id, recipientId: contact.id },
              { senderId: contact.id, recipientId: actor.id },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true, content: true, createdAt: true, senderId: true,
            sender: { select: { id: true, name: true } },
          },
        });
      });
      return {
        kind: "direct" as const,
        id: contact.id,
        name: contact.name,
        subtitle: `${contact.department?.name ?? "全公司"} · @${contact.username ?? contact.name}`,
        messages: messages.reverse().map((message) => ({ ...message, authorId: message.senderId, author: message.sender })),
      };
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
        where: {
          id: projectId,
          status: { not: "ARCHIVED" },
          sourceBusinessModel: { status: { not: "DELETED" } },
        },
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
        where: {
          projectId,
          project: {
            status: { not: "ARCHIVED" },
            sourceBusinessModel: { status: { not: "DELETED" } },
          },
        },
        select: { id: true, project: { select: { members: { where: { userId: actor.id, removedAt: null }, select: { id: true } } } } },
      });
      if (!conversation) throw new ConversationStoreError("CONVERSATION_NOT_FOUND");
      if (!canAccessProjectConversation(actor, conversation.project.members.length > 0)) throw new ConversationStoreError("CONVERSATION_FORBIDDEN");
      const content = prepareConversationMessage(rawContent);
      return database.projectMessage.create({ data: { conversationId: conversation.id, authorId: actor.id, content } });
    },

    async sendDirect(actor: Actor, recipientId: string, rawContent: unknown) {
      const content = prepareConversationMessage(rawContent);
      return database.$transaction(async (transaction) => {
        const target = await transaction.user.findUnique({
          where: { id: recipientId },
          select: { id: true, name: true, isActive: true },
        });
        if (!target) throw new ConversationStoreError("CONVERSATION_NOT_FOUND");
        try {
          assertDirectMessageTarget(actor.id, target);
        } catch {
          throw new ConversationStoreError("CONVERSATION_FORBIDDEN");
        }
        const message = await transaction.directMessage.create({
          data: { senderId: actor.id, recipientId: target.id, content },
        });
        await transaction.notification.create({
          data: {
            recipientId: target.id,
            type: "DIRECT_MESSAGE",
            title: "收到新的私聊消息",
            message: content.length > 80 ? `${content.slice(0, 80)}…` : content,
            resourceId: actor.id,
          },
        });
        return message;
      });
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
