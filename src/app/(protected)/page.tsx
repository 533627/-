import Link from "next/link";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import { MagneticLink } from "@/features/shell/magnetic-link";
import { getRoleHomeCopy } from "@/features/shell/navigation";
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
  const database = getDatabase();
  const canReviewProjects = hasCapability(user.role, "PROJECT_REQUEST_REVIEW");
  const canSeeAllTasks = user.role === "SUPER_ADMIN" || user.role === "OPERATIONS_ADMIN";
  const taskScope = canSeeAllTasks
    ? {}
    : user.role === "DEPARTMENT_MANAGER" && user.department
      ? { assignee: { departmentId: user.department.id } }
      : { assigneeId: user.id };

  const [businessModels, pendingApprovals, activeProjects, openTasks, unreadMessages, recentProjects] =
    await Promise.all([
      database.businessModel.count({ where: { status: "ACTIVE" } }),
      canReviewProjects ? database.projectRequest.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
      database.project.count({ where: { status: { in: ["PREPARING", "IN_PROGRESS", "PAUSED"] }, sourceBusinessModel: { status: { not: "DELETED" } } } }),
      database.task.count({ where: { ...taskScope, status: { in: [...OPEN_TASK_STATUSES] } } }),
      database.notification.count({ where: { recipientId: user.id, isRead: false } }),
      database.project.findMany({
        where: { status: { in: ["PREPARING", "IN_PROGRESS", "PAUSED"] }, sourceBusinessModel: { status: { not: "DELETED" } } },
        orderBy: { updatedAt: "desc" },
        take: 3,
        select: { id: true, name: true, status: true, lead: { select: { name: true } }, _count: { select: { members: true, tasks: true } } },
      }),
    ]);

  const panels = [
    { index: "01", href: "/business-models", label: "商业整理", value: businessModels, note: "沉淀模式、机会与执行打法", className: "bg-[#e7e1c7] text-[#12120f]" },
    { index: "02", href: canReviewProjects ? "/project-requests" : "/tasks", label: canReviewProjects ? "待审批" : "待推进", value: canReviewProjects ? pendingApprovals : openTasks, note: canReviewProjects ? "需要确认价值与资源安排" : "等待接收、执行或提交", className: "bg-[#f06445] text-[#12120f]" },
    { index: "03", href: "/projects", label: "进行中项目", value: activeProjects, note: "项目成员与跨部门推进情况", className: "bg-[#3568e8] text-white" },
    { index: "04", href: "/notifications", label: "未读消息", value: unreadMessages, note: "私聊、审批与协作提醒", className: "bg-[#a7b85d] text-[#12120f]" },
  ];
  const greetingName = user.role === "SUPER_ADMIN"
    ? "老板"
    : user.role === "OPERATIONS_ADMIN"
      ? "运营组长"
      : user.role === "DEPARTMENT_MANAGER"
        ? "部门负责人"
        : "同事";

  return (
    <div className="ops-stage stage-enter -mx-4 -my-6 p-4 sm:-mx-6 sm:p-6 lg:-mx-8 lg:-my-8 lg:p-8">
      <header className="grid gap-6 border-b border-white/15 pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-white/45">{user.department?.name ?? "全公司工作台"} · 下午好，{greetingName}</p>
          <h1 className="mt-4 max-w-5xl text-[clamp(2.6rem,4.5vw,5rem)] font-black leading-[0.96] tracking-[-0.055em]">今日工作概览</h1>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-white/55">{copy.description}</p>
        </div>
        <MagneticLink className="magnetic-action inline-flex min-h-14 items-center justify-center rounded-full bg-[#e7e1c7] px-7 font-bold text-[#12120f] hover:bg-white" href={canReviewProjects ? "/project-requests" : "/tasks"}>
          {canReviewProjects ? "处理立项 →" : "查看任务 →"}
        </MagneticLink>
      </header>

      <section className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-12" aria-label="经营概览">
        {panels.map((panel, index) => (
          <Link
            className={`stage-panel group min-h-52 p-5 transition-transform duration-300 hover:-translate-y-1 sm:p-6 ${panel.className} ${index === 0 || index === 3 ? "xl:col-span-4" : "xl:col-span-2"}`}
            data-index={panel.index}
            href={panel.href}
            key={panel.label}
          >
            <div className="flex items-start justify-between gap-4"><p className="text-sm font-bold">{panel.label}</p><span className="font-mono text-xs opacity-50">{panel.index}</span></div>
            <p className="mt-7 text-7xl font-black leading-none tracking-[-0.08em] tabular-nums">{panel.value}</p>
            <p className="mt-5 max-w-48 text-xs leading-5 opacity-60">{panel.note}</p>
            <span className="absolute right-5 top-1/2 text-2xl transition-transform group-hover:translate-x-1" aria-hidden="true">↗</span>
          </Link>
        ))}
      </section>

      <section className="mt-2 grid gap-2 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="border border-white/15 bg-white/[0.035] p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4"><div><p className="text-xs tracking-[0.2em] text-white/40">项目动态</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">项目脉搏</h2></div><Link className="text-sm text-white/55 hover:text-white" href="/projects">查看全部 ↗</Link></div>
          {recentProjects.length ? <ul className="mt-5 divide-y divide-white/12">{recentProjects.map((project, index) => <li className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-4" key={project.id}><span className="font-mono text-xs text-white/30">0{index + 1}</span><div className="min-w-0"><Link className="block truncate font-semibold hover:text-[#a7b85d]" href={`/projects/${project.id}`}>{project.name}</Link><p className="mt-1 truncate text-xs text-white/40">负责人 {project.lead.name} · {project._count.members} 位成员 · {project._count.tasks} 项任务</p></div><span className="text-xs text-white/50">{projectStatusLabel(project.status)}</span></li>)}</ul> : <div className="py-12 text-center text-sm text-white/45">还没有进行中的项目</div>}
        </div>
        <aside className="flex flex-col justify-between bg-[#e7e1c7] p-5 text-[#12120f] sm:p-6">
          <div><p className="text-xs font-bold tracking-[0.2em] opacity-45">快捷行动</p><h2 className="mt-3 text-3xl font-black leading-tight tracking-[-0.05em]">下一步，<br />从任务开始。</h2><p className="mt-4 text-sm leading-6 opacity-60">当前共有 {openTasks} 项任务需要继续推进。</p></div>
          <MagneticLink className="magnetic-action mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[#12120f] px-6 font-bold text-white" href="/tasks">打开任务待办 →</MagneticLink>
        </aside>
      </section>
    </div>
  );
}

function projectStatusLabel(status: "PREPARING" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "ARCHIVED") {
  return { PREPARING: "筹备中", IN_PROGRESS: "推进中", PAUSED: "已暂停", COMPLETED: "已完成", ARCHIVED: "已归档" }[status];
}
