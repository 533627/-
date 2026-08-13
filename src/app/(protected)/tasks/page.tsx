import Link from "next/link";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import { TaskActionPanel } from "@/features/tasks/task-action-panel";
import {
  formatTaskDate,
  TASK_PRIORITY_BADGES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_BADGES,
  TASK_STATUS_LABELS,
} from "@/features/tasks/task-labels";
import { createPrismaTaskStore } from "@/features/tasks/task-store";
import type { TaskStatus } from "@/generated/prisma/client";
import type { Actor } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";

const STATUS_VALUES: TaskStatus[] = ["PENDING_ACCEPTANCE", "ACCEPTED", "IN_PROGRESS", "PENDING_REVIEW", "NEEDS_REVISION", "COMPLETED"];
const EVENT_LABELS = { ASSIGNED: "派发任务", ACCEPTED: "接收任务", STARTED: "开始执行", SUBMITTED: "提交验收", REJECTED: "退回修改", APPROVED: "验收通过" } as const;

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireCurrentUser();
  const actor: Actor = { id: user.id, role: user.role, departmentId: user.department?.id ?? null };
  const rawStatus = (await searchParams).status;
  const status = typeof rawStatus === "string" && STATUS_VALUES.some((value) => value === rawStatus) ? rawStatus as TaskStatus : undefined;
  const allTasks = await createPrismaTaskStore(getDatabase()).listTasks(actor);
  const tasks = status ? allTasks.filter((task) => task.status === status) : allTasks;
  const metrics = {
    total: allTasks.length,
    inProgress: allTasks.filter((task) => ["ACCEPTED", "IN_PROGRESS", "NEEDS_REVISION"].includes(task.status)).length,
    pendingReview: allTasks.filter((task) => task.status === "PENDING_REVIEW").length,
    overdue: allTasks.filter((task) => task.isOverdue).length,
  };

  return <div className="module-page space-y-6">
    <header className="module-header"><p>接收、执行、提交与验收都在同一条工作流中</p><h1 className="mt-2">任务待办</h1><p className="mt-3 max-w-2xl leading-7 text-base-content/70">{user.role === "EMPLOYEE" ? "优先处理临期和被退回的任务，提交后等待派发人验收。" : "跟进你负责执行或派发的任务，及时处理待验收与逾期事项。"}</p></header>

    <section aria-label="任务指标" className="stats stats-vertical w-full border border-base-300 bg-base-100 sm:stats-horizontal">
      <Metric label="当前任务" value={metrics.total} /><Metric label="执行中" value={metrics.inProgress} /><Metric label="待验收" value={metrics.pendingReview} /><Metric alert label="已逾期" value={metrics.overdue} />
    </section>

    <nav aria-label="任务状态筛选" className="flex flex-wrap gap-2"><FilterLink active={!status} href="/tasks">全部</FilterLink>{STATUS_VALUES.map((value) => <FilterLink active={status === value} href={`/tasks?status=${value}`} key={value}>{TASK_STATUS_LABELS[value]}</FilterLink>)}</nav>

    {tasks.length ? <ul className="space-y-4">{tasks.map((task) => <li className="card card-border bg-base-100" data-testid={`task-${task.id}`} id={`task-${task.id}`} key={task.id}><div className="card-body gap-4 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`badge ${TASK_STATUS_BADGES[task.status]}`}>{TASK_STATUS_LABELS[task.status]}</span><span className={`badge ${TASK_PRIORITY_BADGES[task.priority]}`}>{TASK_PRIORITY_LABELS[task.priority]}优先级</span>{task.isOverdue ? <span className="badge badge-error">已逾期</span> : null}</div><h2 className="mt-3 text-xl font-semibold">{task.title}</h2><p className="mt-1 text-sm text-base-content/55">项目：<Link className="link" href={`/projects/${task.project.id}`}>{task.project.name}</Link></p></div>
        <div className="text-sm sm:text-right"><p className={task.isOverdue ? "font-semibold text-error" : "text-base-content/65"}>截止 {formatTaskDate(task.dueAt)}</p><p className="mt-1 text-base-content/50">版本 {task.version}</p></div>
      </div>
      {task.description ? <p className="whitespace-pre-wrap leading-6 text-base-content/75">{task.description}</p> : null}
      {task.rejectionReason ? <div className="alert alert-error alert-soft"><span>退回原因：{task.rejectionReason}</span></div> : null}
      {task.submissionNote ? <div className="rounded-box bg-base-200 p-3 text-sm"><span className="font-medium">最新成果说明：</span>{task.submissionNote}</div> : null}
      <dl className="grid gap-3 border-y border-base-300 py-3 text-sm sm:grid-cols-2"><div><dt className="text-base-content/50">负责人</dt><dd className="mt-1 font-medium">{task.assignee.name} · {task.assignee.department?.name ?? "未分配部门"}</dd></div><div><dt className="text-base-content/50">派发人</dt><dd className="mt-1 font-medium">{task.assignedBy.name}</dd></div></dl>
      <div><h3 className="text-sm font-semibold">最近记录</h3><ul className="mt-2 space-y-2">{task.events.slice(0, 3).map((event) => <li className="flex flex-wrap justify-between gap-2 text-xs text-base-content/55" key={event.id}><span>{EVENT_LABELS[event.type]} · {event.actor.name}{event.note ? ` · ${event.note}` : ""}</span><time>{formatTaskDate(event.createdAt)}</time></li>)}</ul></div>
      <TaskActionPanel canReview={user.role === "SUPER_ADMIN" || task.assignedById === user.id} isAssignee={task.assigneeId === user.id} projectId={task.projectId} status={task.status} taskId={task.id} version={task.version} />
    </div></li>)}</ul> : <div className="card card-border bg-base-100"><div className="card-body items-center py-12 text-center" role="status"><h2 className="font-semibold">当前没有匹配的任务</h2><p className="text-sm text-base-content/60">项目管理者派发任务后，会出现在这里。</p></div></div>}
  </div>;
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) { return <div className="stat"><div className="stat-title">{label}</div><div className={`stat-value text-3xl ${alert && value ? "text-error" : ""}`}>{value}</div></div>; }
function FilterLink({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) { return <Link aria-current={active ? "page" : undefined} className={`btn btn-sm ${active ? "btn-active" : "btn-ghost"}`} href={href}>{children}</Link>; }
