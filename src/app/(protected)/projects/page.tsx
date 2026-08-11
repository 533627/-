import Link from "next/link";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import { formatProjectDate, PROJECT_STATUS_BADGES, PROJECT_STATUS_LABELS } from "@/features/projects/project-labels";
import { createPrismaProjectStore } from "@/features/projects/project-store";
import type { ProjectStatus } from "@/generated/prisma/client";
import type { Actor } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";

const STATUS_VALUES: ProjectStatus[] = ["PREPARING", "IN_PROGRESS", "PAUSED", "COMPLETED", "ARCHIVED"];

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireCurrentUser();
  const actor: Actor = { id: user.id, role: user.role, departmentId: user.department?.id ?? null };
  const rawStatus = (await searchParams).status;
  const status = typeof rawStatus === "string" && STATUS_VALUES.some((value) => value === rawStatus)
    ? rawStatus as ProjectStatus
    : undefined;
  const projects = await createPrismaProjectStore(getDatabase()).listProjects(actor, status);

  return <div className="space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm text-base-content/60">从商业模式走向跨部门执行</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">项目中心</h1>
        <p className="mt-3 max-w-2xl leading-7 text-base-content/70">
          {user.role === "SUPER_ADMIN" ? "查看公司全部正式项目，并管理负责人、成员和参与部门。" : "这里只显示你仍在参与的项目；退出项目后将不再显示。"}
        </p>
      </div>
      <div className="badge badge-lg badge-soft">{projects.length} 个项目</div>
    </header>

    <nav aria-label="项目状态筛选" className="flex flex-wrap gap-2">
      <FilterLink active={!status} href="/projects">全部</FilterLink>
      {STATUS_VALUES.map((value) => <FilterLink active={status === value} href={`/projects?status=${value}`} key={value}>
        {PROJECT_STATUS_LABELS[value]}
      </FilterLink>)}
    </nav>

    {projects.length ? <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
      <table className="table">
        <thead><tr><th>项目</th><th>状态</th><th>负责人</th><th>协作范围</th><th>最近更新</th><th><span className="sr-only">操作</span></th></tr></thead>
        <tbody>{projects.map((project) => <tr key={project.id}>
          <td>
            <Link className="font-semibold hover:underline" href={`/projects/${project.id}`}>{project.name}</Link>
            <p className="mt-1 max-w-80 truncate text-xs text-base-content/55">来源：{project.sourceBusinessModel.title}</p>
          </td>
          <td><span className={`badge ${PROJECT_STATUS_BADGES[project.status]}`}>{PROJECT_STATUS_LABELS[project.status]}</span></td>
          <td>{project.lead.name}</td>
          <td>
            <p className="text-sm">{project.members.length} 名成员</p>
            <p className="mt-1 text-xs text-base-content/55">{project.departments.map(({ department }) => department.name).join("、") || "未指定部门"}</p>
          </td>
          <td className="whitespace-nowrap text-sm text-base-content/60">{formatProjectDate(project.updatedAt)}</td>
          <td><Link className="btn btn-ghost btn-sm" href={`/projects/${project.id}`}>查看</Link></td>
        </tr>)}</tbody>
      </table>
    </div> : <div className="card card-border bg-base-100">
      <div className="card-body items-center py-12 text-center" role="status">
        <h2 className="font-semibold">当前没有可查看的项目</h2>
        <p className="text-sm text-base-content/60">立项申请获批并转换为正式项目后，会出现在这里。</p>
      </div>
    </div>}
  </div>;
}

function FilterLink({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return <Link aria-current={active ? "page" : undefined} className={`btn btn-sm ${active ? "btn-active" : "btn-ghost"}`} href={href}>{children}</Link>;
}
