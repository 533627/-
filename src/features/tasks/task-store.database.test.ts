import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createPrismaTaskStore, TaskStoreError } from "@/features/tasks/task-store";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
const prefix = `tasks_${randomUUID().replaceAll("-", "").slice(0, 8)}`;

describeWithDatabase.sequential("task assignment and execution", () => {
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const store = createPrismaTaskStore(database);
  const serviceDepartmentId = randomUUID();
  const warehouseDepartmentId = randomUUID();
  const ownerId = randomUUID();
  const operationsId = randomUUID();
  const managerId = randomUUID();
  const employeeId = randomUUID();
  const warehouseEmployeeId = randomUUID();
  const owner = actor(ownerId, "SUPER_ADMIN", null);
  const operations = actor(operationsId, "OPERATIONS_ADMIN", serviceDepartmentId);
  const manager = actor(managerId, "DEPARTMENT_MANAGER", serviceDepartmentId);
  const employee = actor(employeeId, "EMPLOYEE", serviceDepartmentId);
  let projectId = "";
  let businessModelId = "";
  let taskId = "";

  beforeAll(async () => {
    await database.department.createMany({ data: [
      { id: serviceDepartmentId, code: `${prefix}_service`, name: `${prefix}客服部` },
      { id: warehouseDepartmentId, code: `${prefix}_warehouse`, name: `${prefix}仓库部` },
    ] });
    await database.user.createMany({ data: [
      user(ownerId, `${prefix}_owner`, "SUPER_ADMIN", null),
      user(operationsId, `${prefix}_ops`, "OPERATIONS_ADMIN", serviceDepartmentId),
      user(managerId, `${prefix}_manager`, "DEPARTMENT_MANAGER", serviceDepartmentId),
      user(employeeId, `${prefix}_employee`, "EMPLOYEE", serviceDepartmentId),
      user(warehouseEmployeeId, `${prefix}_warehouse_employee`, "EMPLOYEE", warehouseDepartmentId),
    ] });
    const model = await database.businessModel.create({ data: {
      title: `${prefix}商业模式`, category: "家居", targetPlatform: "淘宝", opportunity: "测试需求",
      businessLogic: "内容获客", executionPlan: "测试三组主图", createdById: ownerId, updatedById: ownerId,
    } });
    businessModelId = model.id;
    const suggestion = await database.executionSuggestion.create({ data: { businessModelId, authorId: operationsId, content: "先跑小规模测试" } });
    const request = await database.projectRequest.create({ data: {
      businessModelId, suggestionId: suggestion.id, proposedName: `${prefix}项目`, objective: "验证点击率",
      status: "APPROVED", requestedById: operationsId, reviewedById: ownerId, reviewedAt: new Date(),
    } });
    const project = await database.project.create({ data: {
      name: request.proposedName, objective: request.objective, sourceBusinessModelId: businessModelId,
      sourceRequestId: request.id, leadId: operationsId, createdById: ownerId,
      members: { create: [ownerId, operationsId, managerId, employeeId, warehouseEmployeeId].map((userId) => ({
        userId, role: userId === operationsId ? "LEAD" as const : "MEMBER" as const, addedById: ownerId,
      })) },
      conversation: { create: { createdById: ownerId } },
      events: { create: { actorId: ownerId, type: "CREATED", revision: 1, details: { sourceRequestId: request.id } } },
    } });
    projectId = project.id;
  });

  afterAll(async () => {
    await database.taskEvent.deleteMany({ where: { task: { projectId } } });
    await database.task.deleteMany({ where: { projectId } });
    await database.projectEvent.deleteMany({ where: { projectId } });
    await database.projectConversation.deleteMany({ where: { projectId } });
    await database.projectMember.deleteMany({ where: { projectId } });
    await database.project.deleteMany({ where: { id: projectId } });
    await database.projectRequest.deleteMany({ where: { businessModelId } });
    await database.executionSuggestion.deleteMany({ where: { businessModelId } });
    await database.businessModel.deleteMany({ where: { id: businessModelId } });
    await database.user.deleteMany({ where: { username: { startsWith: prefix } } });
    await database.department.deleteMany({ where: { id: { in: [serviceDepartmentId, warehouseDepartmentId] } } });
    await database.$disconnect();
  });

  it("lets a department manager assign only active project members in their department", async () => {
    const created = await store.createTask(manager, {
      projectId, title: "制作三版商品主图", description: "突出收纳前后对比", priority: "HIGH",
      assigneeId: employeeId, dueAt: futureDate(9),
    });
    taskId = created.id;
    expect(created).toMatchObject({ status: "PENDING_ACCEPTANCE", version: 1, assignedById: managerId });
    await expect(database.taskEvent.findUniqueOrThrow({ where: { taskId_version: { taskId, version: 1 } } }))
      .resolves.toMatchObject({ type: "ASSIGNED", actorId: managerId });
    await expect(store.createTask(manager, {
      projectId, title: "准备仓库样品", description: "准备三种颜色", priority: "MEDIUM",
      assigneeId: warehouseEmployeeId, dueAt: futureDate(9),
    })).rejects.toEqual(new TaskStoreError("TASK_ASSIGN_FORBIDDEN"));
  });

  it("lets the operations administrator assign across departments and blocks employees", async () => {
    await expect(store.createTask(operations, {
      projectId, title: "核对仓库库存", description: "确认三种颜色库存", priority: "URGENT",
      assigneeId: warehouseEmployeeId, dueAt: futureDate(10),
    })).resolves.toMatchObject({ assigneeId: warehouseEmployeeId });
    await expect(store.createTask(employee, {
      projectId, title: "伪造派发", description: "不允许", priority: "LOW",
      assigneeId: employeeId, dueAt: futureDate(10),
    })).rejects.toEqual(new TaskStoreError("TASK_ASSIGN_FORBIDDEN"));
  });

  it("executes, rejects, resubmits, and approves with an ordered audit trail", async () => {
    await store.transition(employee, taskId, 1, { type: "ACCEPT" });
    await store.transition(employee, taskId, 2, { type: "START" });
    await store.transition(employee, taskId, 3, { type: "SUBMIT", note: "已完成三版主图" });
    await store.transition(manager, taskId, 4, { type: "REJECT", note: "第二版卖点不够突出" });
    await store.transition(employee, taskId, 5, { type: "SUBMIT", note: "已调整第二版核心卖点" });
    const completed = await store.transition(manager, taskId, 6, { type: "APPROVE" });
    expect(completed).toMatchObject({ status: "COMPLETED", version: 7, completedAt: expect.any(Date) });
    await expect(database.taskEvent.findMany({ where: { taskId }, orderBy: { version: "asc" }, select: { type: true } }))
      .resolves.toEqual([
        { type: "ASSIGNED" }, { type: "ACCEPTED" }, { type: "STARTED" }, { type: "SUBMITTED" },
        { type: "REJECTED" }, { type: "SUBMITTED" }, { type: "APPROVED" },
      ]);
  });

  it("scopes task lists and calculates completion metrics from approved tasks", async () => {
    const employeeTasks = await store.listTasks(employee);
    expect(employeeTasks).toHaveLength(1);
    expect(employeeTasks[0]).toMatchObject({ id: taskId, isOverdue: false });
    const summary = await store.getProjectTaskSummary(owner, projectId);
    expect(summary).toMatchObject({ total: 2, completed: 1, completionRate: 50 });
    expect(await store.listTasks(manager)).toHaveLength(1);
  });

  function actor(id: string, role: "SUPER_ADMIN" | "OPERATIONS_ADMIN" | "DEPARTMENT_MANAGER" | "EMPLOYEE", departmentId: string | null) {
    return { id, role, departmentId } as const;
  }
  function user(id: string, username: string, role: "SUPER_ADMIN" | "OPERATIONS_ADMIN" | "DEPARTMENT_MANAGER" | "EMPLOYEE", departmentId: string | null) {
    return { id, name: username, email: `${username}@internal.invalid`, emailVerified: true, username, displayUsername: username, role, departmentId };
  }
  function futureDate(days: number) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
});
