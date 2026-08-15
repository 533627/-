import { type PrismaClient, type TaskPriority, type TaskStatus } from "@/generated/prisma/client";
import { canAssignOperationsTeamTask, hasCapability } from "@/lib/authz/permissions";
import type { Actor } from "@/lib/authz/types";
import {
  isTaskOverdue,
  transitionTask,
  type TaskAction,
} from "@/features/tasks/task-state-machine";

export class TaskStoreError extends Error {
  constructor(
    public readonly code:
      | "TASK_ASSIGN_FORBIDDEN"
      | "TASK_PROJECT_FORBIDDEN"
      | "TASK_PROJECT_NOT_ACTIONABLE"
      | "TASK_ASSIGNEE_INVALID"
      | "TASK_INPUT_INVALID"
      | "TASK_NOT_FOUND"
      | "TASK_VIEW_FORBIDDEN"
      | "TASK_CONFLICT",
  ) {
    super(code);
    this.name = "TaskStoreError";
  }
}

export type CreateTaskInput = {
  projectId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  assigneeId: string;
  dueAt: Date;
};

const taskDetails = {
  project: { select: { id: true, name: true, status: true } },
  assignee: { select: { id: true, name: true, department: { select: { id: true, name: true } } } },
  assignedBy: { select: { id: true, name: true } },
  events: { orderBy: { version: "desc" as const }, take: 50, include: { actor: { select: { id: true, name: true } } } },
} as const;

export function createPrismaTaskStore(database: PrismaClient) {
  return {
    async createTask(actor: Actor, rawInput: CreateTaskInput) {
      if (!hasCapability(actor.role, "TASK_ASSIGN")) throw new TaskStoreError("TASK_ASSIGN_FORBIDDEN");
      const input = validateTaskInput(rawInput);
      return database.$transaction(async (transaction) => {
        const project = await transaction.project.findFirst({
          where: {
            id: input.projectId,
            status: { notIn: ["COMPLETED", "ARCHIVED"] },
            ...(actor.role === "SUPER_ADMIN" ? {} : { members: { some: { userId: actor.id, removedAt: null } } }),
          },
          select: { id: true },
        });
        if (!project) throw new TaskStoreError("TASK_PROJECT_NOT_ACTIONABLE");

        const assignee = await transaction.user.findFirst({
          where: {
            id: input.assigneeId,
            isActive: true,
            departmentId: { not: null },
            projectMemberships: { some: { projectId: input.projectId, removedAt: null } },
          },
          select: { id: true, role: true, departmentId: true, operationsTeam: true },
        });
        if (!assignee?.departmentId) throw new TaskStoreError("TASK_ASSIGNEE_INVALID");
        if (actor.role === "OPERATIONS_ADMIN" && assignee.role !== "EMPLOYEE") throw new TaskStoreError("TASK_ASSIGN_FORBIDDEN");
        if (!canAssignOperationsTeamTask(actor, assignee.departmentId, assignee.operationsTeam)) throw new TaskStoreError("TASK_ASSIGN_FORBIDDEN");

        const task = await transaction.task.create({
          data: { ...input, assignedById: actor.id },
        });
        await transaction.taskEvent.create({
          data: { taskId: task.id, actorId: actor.id, type: "ASSIGNED", version: task.version },
        });
        return task;
      });
    },

    async transition(
      actor: Actor,
      taskId: string,
      expectedVersion: number,
      action: { type: TaskAction; note?: string },
    ) {
      return database.$transaction(async (transaction) => {
        const current = await transaction.task.findUnique({ where: { id: taskId } });
        if (!current) throw new TaskStoreError("TASK_NOT_FOUND");
        const transition = transitionTask(actor, current, action);
        const now = new Date();
        const nextVersion = expectedVersion + 1;
        const data = {
          status: transition.status,
          version: nextVersion,
          ...(action.type === "ACCEPT" ? { acceptedAt: now } : {}),
          ...(action.type === "START" ? { startedAt: now } : {}),
          ...(action.type === "SUBMIT" ? { submittedAt: now, submissionNote: transition.note, rejectionReason: null } : {}),
          ...(action.type === "REJECT" ? { rejectionReason: transition.note } : {}),
          ...(action.type === "APPROVE" || action.type === "COMPLETE" ? { completedAt: now } : {}),
        };
        const updated = await transaction.task.updateMany({
          where: { id: taskId, version: expectedVersion, status: current.status },
          data,
        });
        if (updated.count !== 1) throw new TaskStoreError("TASK_CONFLICT");
        await transaction.taskEvent.create({
          data: { taskId, actorId: actor.id, type: transition.eventType, version: nextVersion, note: transition.note },
        });
        return transaction.task.findUniqueOrThrow({ where: { id: taskId } });
      });
    },

    async listTasks(actor: Actor, status?: TaskStatus) {
      const tasks = await database.task.findMany({
        where: {
          project: {
            status: { not: "ARCHIVED" },
            sourceBusinessModel: { status: { not: "DELETED" } },
          },
          ...(status ? { status } : {}),
          ...(actor.role === "SUPER_ADMIN" ? {} : { OR: [{ assigneeId: actor.id }, { assignedById: actor.id }] }),
        },
        orderBy: [{ status: "asc" }, { dueAt: "asc" }],
        take: 200,
        include: taskDetails,
      });
      const now = new Date();
      return tasks.map((task) => ({ ...task, isOverdue: isTaskOverdue(task.dueAt, task.status, now) }));
    },

    async listProjectTasks(actor: Actor, projectId: string) {
      await assertProjectAccess(database, actor, projectId);
      const tasks = await database.task.findMany({
        where: { projectId },
        orderBy: [{ status: "asc" }, { dueAt: "asc" }],
        take: 200,
        include: taskDetails,
      });
      const now = new Date();
      return tasks.map((task) => ({ ...task, isOverdue: isTaskOverdue(task.dueAt, task.status, now) }));
    },

    async listAssignableMembers(actor: Actor, projectId: string) {
      if (!hasCapability(actor.role, "TASK_ASSIGN")) throw new TaskStoreError("TASK_ASSIGN_FORBIDDEN");
      await assertProjectAccess(database, actor, projectId);
      const members = await database.projectMember.findMany({
        where: { projectId, removedAt: null, user: { isActive: true, departmentId: { not: null } } },
        orderBy: { user: { name: "asc" } },
        take: 500,
        select: { user: { select: { id: true, name: true, role: true, departmentId: true, operationsTeam: true, department: { select: { name: true } } } } },
      });
      return members.map(({ user }) => user).filter((user) => user.departmentId
        && (actor.role !== "OPERATIONS_ADMIN" || user.role === "EMPLOYEE")
        && canAssignOperationsTeamTask(actor, user.departmentId, user.operationsTeam));
    },

    async listAssignmentOptions(actor: Actor) {
      if (!hasCapability(actor.role, "TASK_ASSIGN")) throw new TaskStoreError("TASK_ASSIGN_FORBIDDEN");
      const projects = await database.project.findMany({
        where: {
          status: { notIn: ["COMPLETED", "ARCHIVED"] },
          sourceBusinessModel: { status: { not: "DELETED" } },
          ...(actor.role === "SUPER_ADMIN" ? {} : { members: { some: { userId: actor.id, removedAt: null } } }),
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: {
          id: true,
          name: true,
          members: {
            where: { removedAt: null, user: { isActive: true, departmentId: { not: null } } },
            orderBy: { user: { name: "asc" } },
            select: { user: { select: { id: true, name: true, role: true, departmentId: true, operationsTeam: true, department: { select: { name: true } } } } },
          },
        },
      });
      return projects.map((project) => ({
        id: project.id,
        name: project.name,
        members: project.members.map(({ user }) => user).filter((user) => user.departmentId
          && (actor.role !== "OPERATIONS_ADMIN" || user.role === "EMPLOYEE")
          && canAssignOperationsTeamTask(actor, user.departmentId, user.operationsTeam)),
      })).filter((project) => project.members.length);
    },

    async getProjectTaskSummary(actor: Actor, projectId: string) {
      await assertProjectAccess(database, actor, projectId);
      const projectTasks = await database.task.findMany({
        where: { projectId },
        select: { status: true, dueAt: true },
      });
      const now = new Date();
      const total = projectTasks.length;
      const completed = projectTasks.filter((task) => task.status === "COMPLETED").length;
      const pendingReview = projectTasks.filter((task) => task.status === "PENDING_REVIEW").length;
      const overdue = projectTasks.filter((task) => isTaskOverdue(task.dueAt, task.status, now)).length;
      return { total, completed, pendingReview, overdue, completionRate: total ? Math.round((completed / total) * 100) : 0 };
    },
  };
}

function validateTaskInput(input: CreateTaskInput) {
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title || title.length > 200 || description.length > 4000 || Number.isNaN(input.dueAt.getTime()) || input.dueAt <= new Date()) {
    throw new TaskStoreError("TASK_INPUT_INVALID");
  }
  return { ...input, title, description };
}

async function assertProjectAccess(database: PrismaClient, actor: Actor, projectId: string) {
  const project = await database.project.findFirst({
    where: {
      id: projectId,
      status: { not: "ARCHIVED" },
      sourceBusinessModel: { status: { not: "DELETED" } },
      ...(actor.role === "SUPER_ADMIN" ? {} : { members: { some: { userId: actor.id, removedAt: null } } }),
    },
    select: { id: true },
  });
  if (!project) throw new TaskStoreError("TASK_PROJECT_FORBIDDEN");
}
