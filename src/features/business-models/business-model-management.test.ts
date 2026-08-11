import { describe, expect, it } from "vitest";

import {
  assertBusinessModelTransition,
  prepareBusinessModelInput,
} from "@/features/business-models/business-model-management";

const owner = { id: "owner", role: "SUPER_ADMIN", departmentId: null } as const;
const operationsAdmin = {
  id: "ops-lead",
  role: "OPERATIONS_ADMIN",
  departmentId: "00000000-0000-4000-8000-000000000001",
} as const;

describe("prepareBusinessModelInput", () => {
  it("normalizes original content, tags, and keywords", () => {
    expect(
      prepareBusinessModelInput(owner, {
        title: "  小红书家居选品  ",
        category: "  家居  ",
        targetPlatform: "  小红书  ",
        opportunity: "  用户决策依赖场景展示  ",
        businessLogic: "  用场景内容筛选高意向人群  ",
        executionPlan: "  每周测试三组场景图  ",
        costAssumptions: " 样品和拍摄成本 ",
        revenueAssumptions: " 单店月销售额目标 ",
        risks: " 素材同质化 ",
        tags: [" 场景电商 ", "家居", "家居"],
        keywords: [" 小红书 ", "收纳"],
      }),
    ).toEqual({
      title: "小红书家居选品",
      category: "家居",
      targetPlatform: "小红书",
      opportunity: "用户决策依赖场景展示",
      businessLogic: "用场景内容筛选高意向人群",
      executionPlan: "每周测试三组场景图",
      costAssumptions: "样品和拍摄成本",
      revenueAssumptions: "单店月销售额目标",
      risks: "素材同质化",
      tags: ["场景电商", "家居"],
      keywords: ["小红书", "收纳"],
    });
  });

  it("prevents operations administrators from changing original content", () => {
    expect(() =>
      prepareBusinessModelInput(operationsAdmin, {
        title: "越权修改",
        category: "家居",
        targetPlatform: "小红书",
        opportunity: "机会",
        businessLogic: "逻辑",
        executionPlan: "打法",
        tags: [],
        keywords: [],
      }),
    ).toThrowError(expect.objectContaining({ code: "BUSINESS_MODEL_OPERATION_FORBIDDEN" }));
  });

  it("rejects oversized original content at the boundary", () => {
    expect(() =>
      prepareBusinessModelInput(owner, {
        title: "a".repeat(201),
        category: "家居",
        targetPlatform: "小红书",
        opportunity: "机会",
        businessLogic: "逻辑",
        executionPlan: "打法",
        tags: [],
        keywords: [],
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_BUSINESS_MODEL_INPUT" }));
  });
});

describe("business model lifecycle", () => {
  it("allows archive and restore but requires archive before soft deletion", () => {
    expect(() => assertBusinessModelTransition(owner, "ACTIVE", "ARCHIVED")).not.toThrow();
    expect(() => assertBusinessModelTransition(owner, "ARCHIVED", "ACTIVE")).not.toThrow();
    expect(() => assertBusinessModelTransition(owner, "ARCHIVED", "DELETED")).not.toThrow();
    expect(() => assertBusinessModelTransition(owner, "ACTIVE", "DELETED")).toThrowError(
      expect.objectContaining({ code: "INVALID_BUSINESS_MODEL_TRANSITION" }),
    );
  });

  it("keeps operations administrators from forging lifecycle changes", () => {
    expect(() =>
      assertBusinessModelTransition(operationsAdmin, "ACTIVE", "ARCHIVED"),
    ).toThrowError(expect.objectContaining({ code: "BUSINESS_MODEL_OPERATION_FORBIDDEN" }));
  });

  it("makes deleted records terminal", () => {
    expect(() => assertBusinessModelTransition(owner, "DELETED", "ACTIVE")).toThrowError(
      expect.objectContaining({ code: "INVALID_BUSINESS_MODEL_TRANSITION" }),
    );
  });
});
