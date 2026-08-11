import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createPrismaBusinessModelStore } from "@/features/business-models/business-model-store";
import { createProjectFromApprovedRequest } from "@/features/projects/create-from-model";
import { createPrismaProjectRequestStore } from "@/features/project-requests/project-request-store";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
const prefix = `conversion_${randomUUID().replaceAll("-", "").slice(0, 8)}`;

describeWithDatabase.sequential("approved project request conversion", () => {
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const modelStore = createPrismaBusinessModelStore(database);
  const requestStore = createPrismaProjectRequestStore(database);
  const departmentId = randomUUID();
  const ownerId = randomUUID();
  const operationsId = randomUUID();
  const owner = { id: ownerId, role: "SUPER_ADMIN", departmentId: null } as const;
  const operationsAdmin = { id: operationsId, role: "OPERATIONS_ADMIN", departmentId } as const;
  let businessModelId = "";
  let approvedRequestId = "";

  beforeAll(async () => {
    await database.department.create({ data: { id: departmentId, code: `${prefix}_ops`, name: `${prefix}运营部` } });
    await database.user.createMany({ data: [
      user(ownerId, `${prefix}_owner`, "SUPER_ADMIN", null),
      user(operationsId, `${prefix}_ops`, "OPERATIONS_ADMIN", departmentId),
    ] });
    businessModelId = (await modelStore.create(owner, modelInput())).id;
    const suggestion = await requestStore.createSuggestion(operationsAdmin, {
      businessModelId,
      content: "先验证三组主图，再进入供应链核价。",
    });
    const request = await requestStore.createRequest(operationsAdmin, {
      businessModelId,
      suggestionId: suggestion.id,
      proposedName: `${prefix}小红书主图项目`,
      objective: "七天内验证点击率和首单成本。",
    });
    approvedRequestId = request.id;
    await requestStore.review(owner, request.id, 1, "APPROVED", "");
  });

  afterAll(async () => {
    await database.projectEvent.deleteMany({ where: { project: { sourceBusinessModelId: businessModelId } } });
    await database.projectConversation.deleteMany({ where: { project: { sourceBusinessModelId: businessModelId } } });
    await database.projectDepartment.deleteMany({ where: { project: { sourceBusinessModelId: businessModelId } } });
    await database.projectMember.deleteMany({ where: { project: { sourceBusinessModelId: businessModelId } } });
    await database.project.deleteMany({ where: { sourceBusinessModelId: businessModelId } });
    await database.notification.deleteMany({ where: { recipientId: operationsId } });
    await database.projectRequestEvent.deleteMany({ where: { request: { businessModelId } } });
    await database.projectRequest.deleteMany({ where: { businessModelId } });
    await database.executionSuggestion.deleteMany({ where: { businessModelId } });
    await database.businessModelEvent.deleteMany({ where: { businessModelId } });
    await database.businessModel.deleteMany({ where: { id: businessModelId } });
    await database.user.deleteMany({ where: { username: { startsWith: prefix } } });
    await database.department.deleteMany({ where: { id: departmentId } });
    await database.$disconnect();
  });

  it("prevents operations administrators from converting an approved request", async () => {
    await expect(createProjectFromApprovedRequest(database, operationsAdmin, approvedRequestId))
      .rejects.toMatchObject({ code: "PROJECT_CONVERSION_FORBIDDEN" });
    await expect(database.project.count({ where: { sourceRequestId: approvedRequestId } }))
      .resolves.toBe(0);
  });

  it("creates the project, source link, initial members, department, and group atomically", async () => {
    const result = await createProjectFromApprovedRequest(database, owner, approvedRequestId);

    expect(result.created).toBe(true);
    expect(result.project).toMatchObject({
      name: `${prefix}小红书主图项目`,
      objective: "七天内验证点击率和首单成本。",
      status: "PREPARING",
      sourceRequestId: approvedRequestId,
      sourceBusinessModelId: businessModelId,
      leadId: operationsId,
      createdById: ownerId,
    });
    await expect(database.projectMember.findMany({
      where: { projectId: result.project.id },
      orderBy: { role: "asc" },
    })).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: operationsId, role: "LEAD", addedById: ownerId }),
      expect.objectContaining({ userId: ownerId, role: "MEMBER", addedById: ownerId }),
    ]));
    await expect(database.projectDepartment.findUniqueOrThrow({
      where: { projectId_departmentId: { projectId: result.project.id, departmentId } },
    })).resolves.toMatchObject({ addedById: ownerId });
    await expect(database.projectConversation.findUniqueOrThrow({
      where: { projectId: result.project.id },
    })).resolves.toMatchObject({ createdById: ownerId });
    await expect(database.projectEvent.findUniqueOrThrow({
      where: { projectId_revision: { projectId: result.project.id, revision: 1 } },
    })).resolves.toMatchObject({ actorId: ownerId, type: "CREATED" });
  });

  it("returns the same project on repeated conversion without duplicating related rows", async () => {
    const first = await createProjectFromApprovedRequest(database, owner, approvedRequestId);
    const second = await createProjectFromApprovedRequest(database, owner, approvedRequestId);

    expect(first).toMatchObject({ created: false });
    expect(second).toMatchObject({ created: false });
    expect(second.project.id).toBe(first.project.id);
    await expect(database.project.count({ where: { sourceRequestId: approvedRequestId } }))
      .resolves.toBe(1);
    await expect(database.projectConversation.count({ where: { projectId: first.project.id } }))
      .resolves.toBe(1);
  });

  function modelInput() {
    return {
      title: `${prefix}小红书家居选品`, category: "家居", targetPlatform: "小红书",
      opportunity: "用户决策依赖场景展示", businessLogic: "用内容筛选高意向人群",
      executionPlan: "每周测试三组场景图", costAssumptions: "样品成本",
      revenueAssumptions: "单店月销售额目标", risks: "素材同质化",
      tags: ["场景电商"], keywords: ["小红书"],
    };
  }

  function user(id: string, username: string, role: "SUPER_ADMIN" | "OPERATIONS_ADMIN", departmentId: string | null) {
    return { id, name: username, email: `${username}@internal.invalid`, emailVerified: true, username, displayUsername: username, role, departmentId };
  }
});
