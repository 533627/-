import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createPrismaBusinessModelStore } from "@/features/business-models/business-model-store";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
const prefix = `model_${randomUUID().replaceAll("-", "").slice(0, 8)}`;

describeWithDatabase.sequential("business model database operations", () => {
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const store = createPrismaBusinessModelStore(database);
  const ownerId = randomUUID();
  const operationsId = randomUUID();
  const owner = { id: ownerId, role: "SUPER_ADMIN", departmentId: null } as const;
  const operationsAdmin = { id: operationsId, role: "OPERATIONS_ADMIN", departmentId: null } as const;
  let modelId = "";

  beforeAll(async () => {
    await database.user.createMany({ data: [
      user(ownerId, `${prefix}_owner`, "SUPER_ADMIN"),
      user(operationsId, `${prefix}_ops`, "OPERATIONS_ADMIN"),
    ] });
  });

  afterAll(async () => {
    await database.businessModelEvent.deleteMany({ where: { businessModel: { title: { startsWith: prefix } } } });
    await database.businessModel.deleteMany({ where: { title: { startsWith: prefix } } });
    await database.user.deleteMany({ where: { username: { startsWith: prefix } } });
    await database.$disconnect();
  });

  it("creates an active record and immutable creation snapshot atomically", async () => {
    const created = await store.create(owner, input());
    modelId = created.id;

    expect(created).toMatchObject({ status: "ACTIVE", revision: 1, createdById: ownerId });
    await expect(database.businessModelEvent.findFirstOrThrow({ where: { businessModelId: modelId } }))
      .resolves.toMatchObject({ type: "CREATED", revision: 1, actorId: ownerId });
  });

  it("supports category, tag, and keyword filters for operations administrators", async () => {
    const page = await store.list(operationsAdmin, {
      page: 1, pageSize: 20, query: "", category: "家居", tag: "场景电商", keyword: "收纳", includeDeleted: false,
    });
    expect(page.items.map(({ id }) => id)).toContain(modelId);
  });

  it("blocks forged original-content updates from operations administrators", async () => {
    await expect(store.update(operationsAdmin, modelId, 1, { ...input(), title: `${prefix}越权` }))
      .rejects.toMatchObject({ code: "BUSINESS_MODEL_OPERATION_FORBIDDEN" });
  });

  it("increments the revision and rejects stale concurrent edits without an extra event", async () => {
    await expect(store.update(owner, modelId, 1, { ...input(), executionPlan: "更新后的执行打法" }))
      .resolves.toMatchObject({ revision: 2 });
    await expect(store.update(owner, modelId, 1, { ...input(), executionPlan: "过期覆盖" }))
      .rejects.toMatchObject({ code: "BUSINESS_MODEL_CONFLICT" });
    await expect(database.businessModelEvent.count({ where: { businessModelId: modelId } }))
      .resolves.toBe(2);
  });

  it("soft deletes only after archive and keeps every lifecycle snapshot", async () => {
    await store.transition(owner, modelId, 2, "ARCHIVED");
    await store.transition(owner, modelId, 3, "DELETED");

    await expect(database.businessModel.findUniqueOrThrow({ where: { id: modelId } }))
      .resolves.toMatchObject({ status: "DELETED", revision: 4 });
    await expect(database.businessModelEvent.count({ where: { businessModelId: modelId } }))
      .resolves.toBe(4);
    const page = await store.list(operationsAdmin, {
      page: 1, pageSize: 20, query: "", category: "", tag: "", keyword: "", includeDeleted: false,
    });
    expect(page.items.map(({ id }) => id)).not.toContain(modelId);
  });

  function input() {
    return {
      title: `${prefix}小红书家居选品`, category: "家居", targetPlatform: "小红书",
      opportunity: "用户决策依赖场景展示", businessLogic: "用内容筛选高意向人群",
      executionPlan: "每周测试三组场景图", costAssumptions: "样品成本",
      revenueAssumptions: "单店月销售额目标", risks: "素材同质化",
      tags: ["场景电商", "家居"], keywords: ["小红书", "收纳"],
    };
  }

  function user(id: string, username: string, role: "SUPER_ADMIN" | "OPERATIONS_ADMIN") {
    return { id, name: username, email: `${username}@internal.invalid`, emailVerified: true, username, displayUsername: username, role };
  }
});
