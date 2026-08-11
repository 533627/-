import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createPrismaBusinessModelStore } from "@/features/business-models/business-model-store";
import { createPrismaProjectRequestStore } from "@/features/project-requests/project-request-store";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
const prefix = `request_${randomUUID().replaceAll("-", "").slice(0, 8)}`;

describeWithDatabase.sequential("project request database operations", () => {
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const modelStore = createPrismaBusinessModelStore(database);
  const requestStore = createPrismaProjectRequestStore(database);
  const ownerId = randomUUID();
  const operationsId = randomUUID();
  const owner = { id: ownerId, role: "SUPER_ADMIN", departmentId: null } as const;
  const operationsAdmin = { id: operationsId, role: "OPERATIONS_ADMIN", departmentId: null } as const;
  let modelId = "";
  let suggestionId = "";
  let requestId = "";

  beforeAll(async () => {
    await database.user.createMany({ data: [
      user(ownerId, `${prefix}_owner`, "SUPER_ADMIN"),
      user(operationsId, `${prefix}_ops`, "OPERATIONS_ADMIN"),
    ] });
    modelId = (await modelStore.create(owner, modelInput())).id;
  });

  afterAll(async () => {
    await database.notification.deleteMany({ where: { recipient: { username: { startsWith: prefix } } } });
    await database.projectRequestEvent.deleteMany({ where: { request: { businessModelId: modelId } } });
    await database.projectRequest.deleteMany({ where: { businessModelId: modelId } });
    await database.executionSuggestion.deleteMany({ where: { businessModelId: modelId } });
    await database.businessModelEvent.deleteMany({ where: { businessModelId: modelId } });
    await database.businessModel.deleteMany({ where: { id: modelId } });
    await database.user.deleteMany({ where: { username: { startsWith: prefix } } });
    await database.$disconnect();
  });

  it("saves a suggestion separately without changing the original record", async () => {
    const before = await database.businessModel.findUniqueOrThrow({ where: { id: modelId } });
    const suggestion = await requestStore.createSuggestion(operationsAdmin, {
      businessModelId: modelId,
      content: "先测试三组主图，再按点击率追加预算。",
    });
    suggestionId = suggestion.id;
    const after = await database.businessModel.findUniqueOrThrow({ where: { id: modelId } });

    expect(suggestion).toMatchObject({ businessModelId: modelId, authorId: operationsId });
    expect(after).toMatchObject({
      revision: before.revision,
      opportunity: before.opportunity,
      businessLogic: before.businessLogic,
      executionPlan: before.executionPlan,
    });
  });

  it("submits one request for the operations administrator's suggestion", async () => {
    const request = await requestStore.createRequest(operationsAdmin, {
      businessModelId: modelId,
      suggestionId,
      proposedName: "小红书主图试跑",
      objective: "七天内验证点击率和首单成本。",
    });
    requestId = request.id;

    expect(request).toMatchObject({ status: "PENDING", requestedById: operationsId, version: 1 });
    await expect(database.projectRequestEvent.findMany({ where: { requestId } }))
      .resolves.toHaveLength(1);
    await expect(requestStore.createRequest(operationsAdmin, {
      businessModelId: modelId,
      suggestionId,
      proposedName: "重复申请",
      objective: "不应创建",
    })).rejects.toMatchObject({ code: "PROJECT_REQUEST_ALREADY_EXISTS" });
  });

  it("rejects once and atomically notifies the applicant with the reason", async () => {
    await expect(requestStore.review(owner, requestId, 1, "REJECTED", "预算依据不足"))
      .resolves.toMatchObject({ status: "REJECTED", rejectionReason: "预算依据不足", version: 2 });
    await expect(requestStore.review(owner, requestId, 1, "APPROVED", ""))
      .rejects.toMatchObject({ code: "PROJECT_REQUEST_ALREADY_REVIEWED" });

    await expect(database.projectRequestEvent.findMany({ where: { requestId } }))
      .resolves.toHaveLength(2);
    await expect(database.notification.findFirstOrThrow({
      where: { recipientId: operationsId, resourceId: requestId },
    })).resolves.toMatchObject({
      type: "PROJECT_REQUEST_REJECTED",
      message: "预算依据不足",
      isRead: false,
    });
  });

  it("approves a different request and keeps a traceable decision", async () => {
    const suggestion = await requestStore.createSuggestion(operationsAdmin, {
      businessModelId: modelId,
      content: "先做小规模供应链核价。",
    });
    const request = await requestStore.createRequest(operationsAdmin, {
      businessModelId: modelId,
      suggestionId: suggestion.id,
      proposedName: "供应链核价试跑",
      objective: "确认毛利空间。",
    });

    await expect(requestStore.review(owner, request.id, 1, "APPROVED", ""))
      .resolves.toMatchObject({ status: "APPROVED", reviewedById: ownerId, version: 2 });
    await expect(database.notification.findFirstOrThrow({
      where: { recipientId: operationsId, resourceId: request.id },
    })).resolves.toMatchObject({ type: "PROJECT_REQUEST_APPROVED", isRead: false });
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

  function user(id: string, username: string, role: "SUPER_ADMIN" | "OPERATIONS_ADMIN") {
    return { id, name: username, email: `${username}@internal.invalid`, emailVerified: true, username, displayUsername: username, role };
  }
});
