import type { Actor } from "@/lib/authz/types";

export const TASK_STATUSES = [
  "PENDING_ACCEPTANCE",
  "ACCEPTED",
  "IN_PROGRESS",
  "PENDING_REVIEW",
  "NEEDS_REVISION",
  "COMPLETED",
] as const;
export type TaskStatusValue = (typeof TASK_STATUSES)[number];
export type TaskAction = "ACCEPT" | "START" | "SUBMIT" | "REJECT" | "APPROVE" | "COMPLETE";

type TaskWorkflowTarget = {
  status: TaskStatusValue;
  assigneeId: string;
  assignedById: string;
};

export class TaskWorkflowError extends Error {
  constructor(
    public readonly code:
      | "TASK_TRANSITION_INVALID"
      | "TASK_EXECUTE_FORBIDDEN"
      | "TASK_REVIEW_FORBIDDEN"
      | "TASK_NOTE_REQUIRED",
  ) {
    super(code);
    this.name = "TaskWorkflowError";
  }
}

const TRANSITIONS = {
  ACCEPT: { from: ["PENDING_ACCEPTANCE"], to: "ACCEPTED", eventType: "ACCEPTED" },
  START: { from: ["ACCEPTED"], to: "IN_PROGRESS", eventType: "STARTED" },
  SUBMIT: { from: ["IN_PROGRESS", "NEEDS_REVISION"], to: "PENDING_REVIEW", eventType: "SUBMITTED" },
  REJECT: { from: ["PENDING_REVIEW"], to: "NEEDS_REVISION", eventType: "REJECTED" },
  APPROVE: { from: ["PENDING_REVIEW"], to: "COMPLETED", eventType: "APPROVED" },
  COMPLETE: { from: ["PENDING_ACCEPTANCE", "ACCEPTED", "IN_PROGRESS", "NEEDS_REVISION"], to: "COMPLETED", eventType: "APPROVED" },
} as const;

export function transitionTask(
  actor: Actor,
  task: TaskWorkflowTarget,
  action: { type: TaskAction; note?: string },
) {
  const isReview = action.type === "REJECT" || action.type === "APPROVE";
  if (isReview) {
    if (actor.role !== "SUPER_ADMIN" && actor.id !== task.assignedById) {
      throw new TaskWorkflowError("TASK_REVIEW_FORBIDDEN");
    }
  } else if (actor.id !== task.assigneeId) {
    throw new TaskWorkflowError("TASK_EXECUTE_FORBIDDEN");
  }

  const transition = TRANSITIONS[action.type];
  if (!transition.from.some((status) => status === task.status)) {
    throw new TaskWorkflowError("TASK_TRANSITION_INVALID");
  }

  const note = action.note?.trim() || null;
  if ((action.type === "SUBMIT" || action.type === "REJECT") && (!note || note.length < 2 || note.length > 2000)) {
    throw new TaskWorkflowError("TASK_NOTE_REQUIRED");
  }

  return { status: transition.to, eventType: transition.eventType, note };
}

export function isTaskOverdue(dueAt: Date, status: TaskStatusValue, now = new Date()) {
  return status !== "COMPLETED" && dueAt.getTime() < now.getTime();
}
