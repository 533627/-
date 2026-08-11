import { describe, expect, it } from "vitest";

import {
  assertProjectRequestReview,
  prepareExecutionSuggestionInput,
  prepareProjectRequestInput,
} from "@/features/project-requests/project-request-management";

const owner = { id: "owner", role: "SUPER_ADMIN", departmentId: null } as const;
const operationsAdmin = {
  id: "ops-lead",
  role: "OPERATIONS_ADMIN",
  departmentId: "00000000-0000-4000-8000-000000000001",
} as const;
const employee = { id: "employee", role: "EMPLOYEE", departmentId: null } as const;

describe("execution suggestions", () => {
  it("normalizes an operations administrator's suggestion", () => {
    expect(
      prepareExecutionSuggestionInput(operationsAdmin, {
        businessModelId: "00000000-0000-4000-8000-000000000010",
        content: "  先测试三组主图，再按点击率追加预算。  ",
      }),
    ).toEqual({
      businessModelId: "00000000-0000-4000-8000-000000000010",
      content: "先测试三组主图，再按点击率追加预算。",
    });
  });

  it("rejects employees and oversized suggestions", () => {
    expect(() =>
      prepareExecutionSuggestionInput(employee, {
        businessModelId: "00000000-0000-4000-8000-000000000010",
        content: "越权建议",
      }),
    ).toThrowError(expect.objectContaining({ code: "EXECUTION_SUGGESTION_FORBIDDEN" }));
    expect(() =>
      prepareExecutionSuggestionInput(operationsAdmin, {
        businessModelId: "00000000-0000-4000-8000-000000000010",
        content: "a".repeat(10_001),
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_EXECUTION_SUGGESTION" }));
  });
});

describe("project requests", () => {
  it("normalizes a request linked to a suggestion", () => {
    expect(
      prepareProjectRequestInput(operationsAdmin, {
        businessModelId: "00000000-0000-4000-8000-000000000010",
        suggestionId: "00000000-0000-4000-8000-000000000011",
        proposedName: "  小红书家居主图试跑  ",
        objective: "  七天内验证点击率和首单成本。  ",
      }),
    ).toEqual({
      businessModelId: "00000000-0000-4000-8000-000000000010",
      suggestionId: "00000000-0000-4000-8000-000000000011",
      proposedName: "小红书家居主图试跑",
      objective: "七天内验证点击率和首单成本。",
    });
  });

  it("allows only the highest administrator to review", () => {
    expect(() => assertProjectRequestReview(operationsAdmin, "PENDING", "APPROVED", ""))
      .toThrowError(expect.objectContaining({ code: "PROJECT_REQUEST_REVIEW_FORBIDDEN" }));
    expect(assertProjectRequestReview(owner, "PENDING", "APPROVED", "")).toEqual({
      decision: "APPROVED",
      rejectionReason: null,
    });
  });

  it("requires a rejection reason", () => {
    expect(() => assertProjectRequestReview(owner, "PENDING", "REJECTED", "  "))
      .toThrowError(expect.objectContaining({ code: "PROJECT_REQUEST_REJECTION_REASON_REQUIRED" }));
    expect(assertProjectRequestReview(owner, "PENDING", "REJECTED", "  预算依据不足  "))
      .toEqual({ decision: "REJECTED", rejectionReason: "预算依据不足" });
  });

  it("rejects a second review of the same request", () => {
    expect(() => assertProjectRequestReview(owner, "APPROVED", "REJECTED", "改为拒绝"))
      .toThrowError(expect.objectContaining({ code: "PROJECT_REQUEST_ALREADY_REVIEWED" }));
    expect(() => assertProjectRequestReview(owner, "REJECTED", "APPROVED", ""))
      .toThrowError(expect.objectContaining({ code: "PROJECT_REQUEST_ALREADY_REVIEWED" }));
  });
});
