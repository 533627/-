import { hasCapability } from "@/lib/authz/permissions";
import type { Capability, Role } from "@/lib/authz/types";

export type WorkspaceNavigationItem = {
  slug: string;
  href: string;
  label: string;
  marker: string;
  description: string;
  capability: Capability;
};

const WORKSPACE_NAVIGATION = [
  {
    slug: "home",
    href: "/",
    label: "工作台",
    marker: "台",
    description: "查看当前职责和待推进事项",
    capability: "DASHBOARD_VIEW",
  },
  {
    slug: "business-models",
    href: "/business-models",
    label: "商业整理",
    marker: "商",
    description: "沉淀项目逻辑和商业模式打法",
    capability: "BUSINESS_MODEL_VIEW",
  },
  {
    slug: "project-requests",
    href: "/project-requests",
    label: "立项审批",
    marker: "审",
    description: "查看并审批运营提交的立项申请",
    capability: "PROJECT_REQUEST_REVIEW",
  },
  {
    slug: "projects",
    href: "/projects",
    label: "项目协作",
    marker: "项",
    description: "跟进已立项项目和跨部门成员",
    capability: "PROJECT_VIEW",
  },
  {
    slug: "tasks",
    href: "/tasks",
    label: "任务待办",
    marker: "办",
    description: "接收、提交和验收工作任务",
    capability: "TASK_EXECUTE",
  },
  {
    slug: "conversations",
    href: "/conversations",
    label: "协作群聊",
    marker: "聊",
    description: "进入部门群和项目协作群",
    capability: "DEPARTMENT_CONVERSATION_ACCESS",
  },
  {
    slug: "accounts",
    href: "/accounts",
    label: "账号终端",
    marker: "账",
    description: "创建、停用和重置员工账号",
    capability: "ACCOUNT_MANAGE",
  },
  {
    slug: "departments",
    href: "/departments",
    label: "部门管理",
    marker: "部",
    description: "维护部门结构和人员归属",
    capability: "DEPARTMENT_MEMBERS_VIEW",
  },
  {
    slug: "audit",
    href: "/audit",
    label: "审计记录",
    marker: "记",
    description: "检查关键账号和业务操作留痕",
    capability: "AUDIT_LOG_VIEW",
  },
] as const satisfies readonly WorkspaceNavigationItem[];

const ROLE_HOME_COPY: Record<Role, { title: string; description: string }> = {
  SUPER_ADMIN: {
    title: "掌握全公司项目推进",
    description: "从商业模式、立项和任务执行中找到需要决策与协调的下一步。",
  },
  OPERATIONS_ADMIN: {
    title: "管理跨部门运营执行",
    description: "承接商业项目，组织成员，并推动各部门按计划交付。",
  },
  DEPARTMENT_MANAGER: {
    title: "推进本部门任务闭环",
    description: "安排部门工作，跟进成员提交，并完成验收和协作。",
  },
  EMPLOYEE: {
    title: "完成今天的任务",
    description: "查看待办和项目消息，提交成果，让工作进度持续可见。",
  },
};

export function getNavigationForRole(role: Role) {
  return WORKSPACE_NAVIGATION.filter(({ capability }) =>
    hasCapability(role, capability),
  );
}

export function getWorkspaceModule(slug: string, role: Role) {
  const workspaceModule = WORKSPACE_NAVIGATION.find(
    (item) => item.slug !== "home" && item.slug === slug,
  );

  return workspaceModule && hasCapability(role, workspaceModule.capability)
    ? workspaceModule
    : null;
}

export function getRoleHomeCopy(role: Role) {
  return ROLE_HOME_COPY[role];
}
