import { describe, expect, it } from "vitest";

import {
  isTaskOverdue,
  transitionTask,
  TaskWorkflowError,
} from "@/features/tasks/task-state-machine";

const assignee = { id: "employee", role: "EMPLOYEE", departmentId: "service" } as const;
const assigner = { id: "manager", role: "DEPARTMENT_MANAGER", departmentId: "service" } as const;
const owner = { id: "owner", role: "SUPER_ADMIN", departmentId: null } as const;

describe("task state machine", () => {
  it("requires acceptance before work can start", () => {
    expect(() => transitionTask(assignee, task("PENDING_ACCEPTANCE"), { type: "START" }))
      .toThrowError(new TaskWorkflowError("TASK_TRANSITION_INVALID"));
    expect(transitionTask(assignee, task("PENDING_ACCEPTANCE"), { type: "ACCEPT" }))
      .toMatchObject({ status: "ACCEPTED", eventType: "ACCEPTED" });
  });

  it("requires execution and submission before completion", () => {
    expect(() => transitionTask(assigner, task("IN_PROGRESS"), { type: "APPROVE" }))
      .toThrowError(new TaskWorkflowError("TASK_TRANSITION_INVALID"));
    expect(transitionTask(assignee, task("IN_PROGRESS"), { type: "SUBMIT", note: "已完成三版主图" }))
      .toMatchObject({ status: "PENDING_REVIEW", eventType: "SUBMITTED", note: "已完成三版主图" });
    expect(transitionTask(assigner, task("PENDING_REVIEW"), { type: "APPROVE" }))
      .toMatchObject({ status: "COMPLETED", eventType: "APPROVED" });
  });

  it("requires a rejection reason and lets the assignee resubmit", () => {
    expect(() => transitionTask(assigner, task("PENDING_REVIEW"), { type: "REJECT", note: "" }))
      .toThrowError(new TaskWorkflowError("TASK_NOTE_REQUIRED"));
    expect(transitionTask(assigner, task("PENDING_REVIEW"), { type: "REJECT", note: "第二张图卖点不清晰" }))
      .toMatchObject({ status: "NEEDS_REVISION", eventType: "REJECTED", note: "第二张图卖点不清晰" });
    expect(transitionTask(assignee, task("NEEDS_REVISION"), { type: "SUBMIT", note: "已重新突出核心卖点" }))
      .toMatchObject({ status: "PENDING_REVIEW", eventType: "SUBMITTED" });
  });

  it("prevents another employee from operating the task", () => {
    const outsider = { id: "outsider", role: "EMPLOYEE", departmentId: "service" } as const;
    expect(() => transitionTask(outsider, task("PENDING_ACCEPTANCE"), { type: "ACCEPT" }))
      .toThrowError(new TaskWorkflowError("TASK_EXECUTE_FORBIDDEN"));
  });

  it("allows only the assigner or highest administrator to review", () => {
    const otherManager = { id: "other", role: "DEPARTMENT_MANAGER", departmentId: "service" } as const;
    expect(() => transitionTask(otherManager, task("PENDING_REVIEW"), { type: "APPROVE" }))
      .toThrowError(new TaskWorkflowError("TASK_REVIEW_FORBIDDEN"));
    expect(transitionTask(owner, task("PENDING_REVIEW"), { type: "APPROVE" }).status).toBe("COMPLETED");
  });

  it("rejects repeated operations instead of generating duplicate events", () => {
    expect(() => transitionTask(assignee, task("ACCEPTED"), { type: "ACCEPT" }))
      .toThrowError(new TaskWorkflowError("TASK_TRANSITION_INVALID"));
  });

  it("derives overdue state from the server clock and excludes completed work", () => {
    const now = new Date("2026-08-11T10:00:00.000Z");
    expect(isTaskOverdue(new Date("2026-08-11T09:59:00.000Z"), "IN_PROGRESS", now)).toBe(true);
    expect(isTaskOverdue(new Date("2026-08-11T09:59:00.000Z"), "COMPLETED", now)).toBe(false);
  });
});

function task(status: "PENDING_ACCEPTANCE" | "ACCEPTED" | "IN_PROGRESS" | "PENDING_REVIEW" | "NEEDS_REVISION" | "COMPLETED") {
  return { status, assigneeId: assignee.id, assignedById: assigner.id };
}
