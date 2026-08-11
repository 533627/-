import type { TaskPriority, TaskStatus } from "@/generated/prisma/client";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING_ACCEPTANCE: "待接收", ACCEPTED: "已接收", IN_PROGRESS: "进行中",
  PENDING_REVIEW: "待验收", NEEDS_REVISION: "需修改", COMPLETED: "已完成",
};
export const TASK_STATUS_BADGES: Record<TaskStatus, string> = {
  PENDING_ACCEPTANCE: "badge-warning badge-soft", ACCEPTED: "badge-info badge-soft",
  IN_PROGRESS: "badge-info", PENDING_REVIEW: "badge-warning", NEEDS_REVISION: "badge-error badge-soft",
  COMPLETED: "badge-success badge-soft",
};
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "低", MEDIUM: "普通", HIGH: "高", URGENT: "紧急",
};
export const TASK_PRIORITY_BADGES: Record<TaskPriority, string> = {
  LOW: "badge-ghost", MEDIUM: "badge-outline", HIGH: "badge-warning badge-soft", URGENT: "badge-error badge-soft",
};

export function formatTaskDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" }).format(date);
}
