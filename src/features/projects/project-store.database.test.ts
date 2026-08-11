import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { ProjectManagementError } from "@/features/projects/project-management";
import { createPrismaProjectStore } from "@/features/projects/project-store";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
const prefix = `projects_${randomUUID().replaceAll("-", "").slice(0, 8)}`;

describeWithDatabase.sequential("project membership and timeline", () => {
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const store = createPrismaProjectStore(database);
  const operationsDepartmentId = randomUUID();
  const serviceDepartmentId = randomUUID();
  const ownerId = randomUUID();
  const leadId = randomUUID();
  const memberId = randomUUID();
  const outsiderId = randomUUID();
  const owner = { id: ownerId, role: "SUPER_ADMIN", departmentId: null } as const;
  const lead = { id: leadId, role: "OPERATIONS_ADMIN", departmentId: operationsDepartmentId } as const;
  const member = { id: memberId, role: "EMPLOYEE", departmentId: serviceDepartmentId } as const;
  const outsider = { id: outsiderId, role: "EMPLOYEE", departmentId: serviceDepartmentId } as const;
  let projectId = "";

  beforeAll(async () => {
    await database.department.createMany({ data: [
      { id: operationsDepartmentId, code: `${prefix}_ops`, name: `${prefix}运营部` },
      { id: serviceDepartmentId, code: `${prefix}_service`, name: `${prefix}客服部` },
    ] });
    await database.user.createMany({ data: [
      user(ownerId, `${prefix}_owner`, "SUPER_ADMIN", null),
      user(leadId, `${prefix}_lead`, "OPERATIONS_ADMIN", operationsDepartmentId),
      user(memberId, `${prefix}_member`, "EMPLOYEE", serviceDepartmentId),
      user(outsiderId, `${prefix}_outsider`, "EMPLOYEE", serviceDepartmentId),
    ] });
    const model = await database.businessModel.create({ data: {
      title: `${prefix}商业模式`, category: "家居", targetPlatform: "淘宝",
      opportunity: "验证需求", businessLogic: "内容获客", executionPlan: "测试素材",
      createdById: ownerId, updatedById: ownerId,
    } });
    const suggestion = await database.executionSuggestion.create({ data: {
      businessModelId: model.id, authorId: leadId, content: "先做小规模验证",
    } });
    const request = await database.projectRequest.create({ data: {
      businessModelId: model.id, suggestionId: suggestion.id, proposedName: `${prefix}项目`,
      objective: "七天验证转化率", status: "APPROVED", requestedById: leadId,
      reviewedById: ownerId, reviewedAt: new Date(),
    } });
    const project = await database.project.create({ data: {
      name: request.proposedName, objective: request.objective, sourceBusinessModelId: model.id,
      sourceRequestId: request.id, leadId, createdById: ownerId,
      members: { create: [
        { userId: leadId, role: "LEAD", addedById: ownerId },
        { userId: ownerId, role: "MEMBER", addedById: ownerId },
      ] },
      departments: { create: { departmentId: operationsDepartmentId, addedById: ownerId } },
      conversation: { create: { createdById: ownerId } },
      events: { create: { actorId: ownerId, type: "CREATED", revision: 1, details: { sourceRequestId: request.id } } },
    } });
    projectId = project.id;
  });

  afterAll(async () => {
    const model = await database.businessModel.findFirst({ where: { title: `${prefix}商业模式` } });
    if (model) {
      await database.projectEvent.deleteMany({ where: { project: { sourceBusinessModelId: model.id } } });
      await database.projectConversation.deleteMany({ where: { project: { sourceBusinessModelId: model.id } } });
      await database.projectDepartment.deleteMany({ where: { project: { sourceBusinessModelId: model.id } } });
      await database.projectMember.deleteMany({ where: { project: { sourceBusinessModelId: model.id } } });
      await database.project.deleteMany({ where: { sourceBusinessModelId: model.id } });
      await database.projectRequest.deleteMany({ where: { businessModelId: model.id } });
      await database.executionSuggestion.deleteMany({ where: { businessModelId: model.id } });
      await database.businessModel.delete({ where: { id: model.id } });
    }
    await database.user.deleteMany({ where: { username: { startsWith: prefix } } });
    await database.department.deleteMany({ where: { id: { in: [operationsDepartmentId, serviceDepartmentId] } } });
    await database.$disconnect();
  });

  it("scopes project lists and detail to active members", async () => {
    await expect(store.listProjects(owner)).resolves.toHaveLength(1);
    await expect(store.listProjects(lead)).resolves.toHaveLength(1);
    await expect(store.listProjects(outsider)).resolves.toHaveLength(0);
    await expect(store.getProject(outsider, projectId))
      .rejects.toEqual(new ProjectManagementError("PROJECT_VIEW_FORBIDDEN"));
  });

  it("adds a member and department and records both timeline events", async () => {
    await store.addMember(owner, projectId, memberId, 1);
    await expect(store.getProject(member, projectId)).resolves.toMatchObject({ id: projectId });
    await store.addDepartment(owner, projectId, serviceDepartmentId, 2);
    const project = await store.getProject(owner, projectId);
    expect(project.revision).toBe(3);
    expect(project.events.map((event) => event.type)).toEqual([
      "DEPARTMENT_ADDED", "MEMBER_ADDED", "CREATED",
    ]);
  });

  it("revokes access immediately while preserving membership history", async () => {
    await store.removeMember(owner, projectId, memberId, 3);
    await expect(store.getProject(member, projectId))
      .rejects.toEqual(new ProjectManagementError("PROJECT_VIEW_FORBIDDEN"));
    await expect(database.projectMember.findUniqueOrThrow({
      where: { projectId_userId: { projectId, userId: memberId } },
    })).resolves.toMatchObject({ removedAt: expect.any(Date) });
    await expect(database.projectEvent.findFirstOrThrow({
      where: { projectId, type: "MEMBER_REMOVED" },
    })).resolves.toMatchObject({ actorId: ownerId, revision: 4 });
  });

  it("requires lead handoff before the current lead can be removed", async () => {
    await expect(store.removeMember(owner, projectId, leadId, 4))
      .rejects.toEqual(new ProjectManagementError("PROJECT_LEAD_REMOVAL_FORBIDDEN"));
    await store.changeLead(owner, projectId, ownerId, 4);
    await store.removeMember(owner, projectId, leadId, 5);
    await expect(store.getProject(lead, projectId))
      .rejects.toEqual(new ProjectManagementError("PROJECT_VIEW_FORBIDDEN"));
  });

  it("changes project status and participant department with ordered events", async () => {
    await store.changeStatus(owner, projectId, "IN_PROGRESS", 6);
    await store.removeDepartment(owner, projectId, serviceDepartmentId, 7);
    const project = await store.getProject(owner, projectId);
    expect(project).toMatchObject({ status: "IN_PROGRESS", revision: 8 });
    expect(project.events.slice(0, 2).map((event) => event.type)).toEqual([
      "DEPARTMENT_REMOVED", "STATUS_CHANGED",
    ]);
  });

  function user(id: string, username: string, role: "SUPER_ADMIN" | "OPERATIONS_ADMIN" | "EMPLOYEE", departmentId: string | null) {
    return { id, name: username, email: `${username}@internal.invalid`, emailVerified: true, username, displayUsername: username, role, departmentId };
  }
});
