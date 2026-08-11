import type { ProjectEventType, ProjectStatus } from "@/generated/prisma/client";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PREPARING: "准备中",
  IN_PROGRESS: "进行中",
  PAUSED: "已暂停",
  COMPLETED: "已完成",
  ARCHIVED: "已归档",
};

export const PROJECT_STATUS_BADGES: Record<ProjectStatus, string> = {
  PREPARING: "badge-warning badge-soft",
  IN_PROGRESS: "badge-info badge-soft",
  PAUSED: "badge-ghost",
  COMPLETED: "badge-success badge-soft",
  ARCHIVED: "badge-neutral badge-soft",
};

export const PROJECT_EVENT_LABELS: Record<ProjectEventType, string> = {
  CREATED: "创建正式项目",
  STATUS_CHANGED: "更新项目状态",
  LEAD_CHANGED: "交接项目负责人",
  MEMBER_ADDED: "添加项目成员",
  MEMBER_REMOVED: "移除项目成员",
  DEPARTMENT_ADDED: "添加参与部门",
  DEPARTMENT_REMOVED: "移除参与部门",
};

export function formatProjectDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(date);
}
