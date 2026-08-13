import Link from "next/link";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import { getNavigationForRole, getRoleHomeCopy } from "@/features/shell/navigation";
import { hasCapability } from "@/lib/authz/permissions";
import { getDatabase } from "@/lib/db";

const OPEN_TASK_STATUSES = [
  "PENDING_ACCEPTANCE",
  "ACCEPTED",
  "IN_PROGRESS",
  "PENDING_REVIEW",
  "NEEDS_REVISION",
] as const;

export default async function WorkspaceHomePage() {
  const user = await requireCurrentUser();
  const copy = getRoleHomeCopy(user.role);
  const availableModules = getNavigationForRole(user.role).filter(({ href }) => href !== "/");
  const database = getDatabase();
  const canReviewProjects = hasCapability(user.role, "PROJECT_REQUEST_REVIEW");
  const canSeeAllTasks = user.role === "SUPER_ADMIN" || user.role === "OPERATIONS_ADMIN";
  const taskScope = canSeeAllTasks
    ? {}
    : user.role === "DEPARTMENT_MANAGER" && user.department
      ? { assignee: { departmentId: user.department.id } }
      : { assigneeId: user.id };

  const [pendingApprovals, activeProjects, openTasks, overdueTasks, recentProjects] =
    await Promise.all([
      canReviewProjects
        ? database.projectRequest.count({ where: { status: "PENDING" } })
        : Promise.resolve(0),
      database.project.count({
        where: { status: { in: ["PREPARING", "IN_PROGRESS", "PAUSED"] } },
      }),
      database.task.count({
        where: { ...taskScope, status: { in: [...OPEN_TASK_STATUSES] } },
      }),
      database.task.count({
        where: {
          ...taskScope,
          dueAt: { lt: new Date() },
          status: { in: [...OPEN_TASK_STATUSES] },
        },
      }),
      database.project.findMany({
        where: { status: { in: ["PREPARING", "IN_PROGRESS", "PAUSED"] } },
        orderBy: { updatedAt: "desc" },
        take: 4,
        select: {
          id: true,
          name: true,
          status: true,
          lead: { select: { name: true } },
          _count: { select: { members: true, tasks: true } },
        },
      }),
    ]);

  const actionItems = [
    ...(canReviewProjects
      ? [{
          href: "/project-requests",
          label: "待审批立项",
          value: pendingApprovals,
          hint: "需要老板确认商业价值与资源安排",
          tone: pendingApprovals > 0 ? "warning" : "neutral",
        } as const]
      : []),
    {
      href: "/tasks",
      label: "待推进任务",
      value: openTasks,
      hint: overdueTasks > 0 ? "其中 " + overdueTasks + " 项已经逾期" : "当前没有逾期任务",
      tone: overdueTasks > 0 ? "error" : "success",
    } as const,
    {
      href: "/projects",
      label: "进行中项目",
      value: activeProjects,
      hint: "查看负责人、成员与跨部门执行情况",
      tone: "primary",
    } as const,
  ];

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 border-b border-base-300/80 pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-base-content/55">
            <span className="status status-sm status-success" aria-hidden="true" />
            {user.department?.name ?? "全公司作战视图"}
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-[2rem]" id="workspace-title">
            {copy.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-base-content/65">{copy.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-primary btn-sm" href="/tasks">查看任务</Link>
          <Link className="btn btn-sm" href="/conversations">进入群聊</Link>
        </div>
      </header>

      <section aria-labelledby="overview-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold" id="overview-title">今日经营概览</h2>
          <p className="text-xs text-base-content/50">数据随业务进度实时更新</p>
        </div>
        <div className="grid gap-px overflow-hidden rounded-box border border-base-300 bg-base-300 sm:grid-cols-2 lg:grid-cols-3">
          {actionItems.map((item) => (
            <Link className="group bg-base-100 p-5 transition-colors hover:bg-base-200" href={item.href} key={item.label}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-base-content/65">{item.label}</p>
                  <p className="mt-3 text-3xl font-bold tabular-nums">{item.value}</p>
                </div>
                <span aria-hidden="true" className={"status status-sm " + statusTone(item.tone)} />
              </div>
              <p className="mt-4 text-xs leading-5 text-base-content/55">{item.hint}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
        <section className="overflow-hidden rounded-box border border-base-300 bg-base-100" aria-labelledby="projects-title">
          <div className="flex items-center justify-between border-b border-base-300 px-5 py-4">
            <div>
              <h2 className="font-semibold" id="projects-title">项目推进</h2>
              <p className="mt-1 text-xs text-base-content/55">最近更新的项目与协作情况</p>
            </div>
            <Link className="btn btn-ghost btn-sm" href="/projects">查看全部</Link>
          </div>
          {recentProjects.length > 0 ? (
            <ul className="list">
              {recentProjects.map((project) => (
                <li className="list-row items-center rounded-none border-b border-base-300/70 px-5 py-4 last:border-b-0" key={project.id}>
                  <span aria-hidden="true" className={"status status-sm " + projectStatusTone(project.status)} />
                  <div className="list-col-grow min-w-0">
                    <Link className="font-medium hover:text-primary" href={"/projects/" + project.id}>{project.name}</Link>
                    <p className="mt-1 truncate text-xs text-base-content/55">
                      负责人 {project.lead.name} · {project._count.members} 位成员 · {project._count.tasks} 项任务
                    </p>
                  </div>
                  <span className="badge badge-sm badge-ghost">{projectStatusLabel(project.status)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-12 text-center">
              <p className="font-medium">还没有进行中的项目</p>
              <p className="mt-2 text-sm text-base-content/55">从商业整理中选定机会并提交立项后，会在这里跟进。</p>
            </div>
          )}
        </section>

        <aside className="rounded-box bg-neutral p-5 text-neutral-content" aria-labelledby="quick-entry-title">
          <p className="text-xs text-neutral-content/50">快捷入口</p>
          <h2 className="mt-2 text-lg font-semibold" id="quick-entry-title">继续推进下一步</h2>
          <div className="mt-5 space-y-1">
            {availableModules.slice(0, 6).map((item) => (
              <Link
                className="group flex items-center gap-3 rounded-field px-2 py-2.5 text-sm text-neutral-content/70 transition-colors hover:bg-neutral-content/8 hover:text-neutral-content"
                href={item.href}
                key={item.href}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-selector bg-neutral-content/8 text-xs">{item.marker}</span>
                <span className="min-w-0">
                  <span className="block font-medium">{item.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-neutral-content/40">{item.description}</span>
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-6 border-t border-neutral-content/12 pt-4 text-xs text-neutral-content/50">
            当前身份：{user.name} · @{user.username}
          </div>
        </aside>
      </div>
    </div>
  );
}

function statusTone(tone: "warning" | "error" | "success" | "primary" | "neutral") {
  return {
    warning: "status-warning",
    error: "status-error",
    success: "status-success",
    primary: "status-primary",
    neutral: "status-neutral",
  }[tone];
}

function projectStatusTone(status: "PREPARING" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "ARCHIVED") {
  if (status === "IN_PROGRESS") return "status-success";
  if (status === "PAUSED") return "status-warning";
  return "status-info";
}

function projectStatusLabel(status: "PREPARING" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "ARCHIVED") {
  return {
    PREPARING: "筹备中",
    IN_PROGRESS: "推进中",
    PAUSED: "已暂停",
    COMPLETED: "已完成",
    ARCHIVED: "已归档",
  }[status];
}
