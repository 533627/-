import Link from "next/link";
import { notFound } from "next/navigation";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import { ProjectManagementError } from "@/features/projects/project-management";
import { ProjectManagementPanel } from "@/features/projects/project-management-panel";
import { formatProjectDate, PROJECT_STATUS_BADGES, PROJECT_STATUS_LABELS } from "@/features/projects/project-labels";
import { createPrismaProjectStore } from "@/features/projects/project-store";
import { ProjectTimeline } from "@/features/projects/project-timeline";
import type { Actor } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const actor: Actor = { id: user.id, role: user.role, departmentId: user.department?.id ?? null };
  const store = createPrismaProjectStore(getDatabase());
  let project;
  try {
    project = await store.getProject(actor, id);
  } catch (error) {
    if (error instanceof ProjectManagementError && ["PROJECT_NOT_FOUND", "PROJECT_VIEW_FORBIDDEN"].includes(error.code)) notFound();
    throw error;
  }

  const options = user.role === "SUPER_ADMIN" ? await store.getManagementOptions(actor) : null;
  const memberIds = new Set(project.members.map(({ userId }) => userId));
  const departmentIds = new Set(project.departments.map(({ departmentId }) => departmentId));

  return <div className="space-y-6">
    <nav aria-label="面包屑" className="text-sm text-base-content/60"><Link className="link" href="/projects">项目中心</Link><span aria-hidden="true"> / </span><span>{project.name}</span></nav>

    <header className="card card-border bg-base-100">
      <div className="card-body gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`badge ${PROJECT_STATUS_BADGES[project.status]}`}>{PROJECT_STATUS_LABELS[project.status]}</span>
          <span className="badge badge-ghost">版本 {project.revision}</span>
          <span className="badge badge-ghost">{project.sourceBusinessModel.targetPlatform}</span>
        </div>
        <div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{project.name}</h1><p className="mt-3 max-w-3xl whitespace-pre-wrap leading-7 text-base-content/75">{project.objective}</p></div>
        <dl className="grid gap-4 border-t border-base-300 pt-4 text-sm sm:grid-cols-3">
          <div><dt className="text-base-content/50">负责人</dt><dd className="mt-1 font-medium">{project.lead.name}</dd></div>
          <div><dt className="text-base-content/50">启动时间</dt><dd className="mt-1 font-medium">{formatProjectDate(project.startAt)}</dd></div>
          <div><dt className="text-base-content/50">项目协作群</dt><dd className="mt-1 font-medium">{project.conversation ? "已自动建立" : "尚未建立"}</dd></div>
        </dl>
      </div>
    </header>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,1fr)]">
      <div className="space-y-6">
        <section aria-labelledby="source-title" className="card card-border bg-base-100"><div className="card-body p-5">
          <h2 className="card-title" id="source-title">立项来源</h2>
          <p className="text-sm text-base-content/55">{project.sourceBusinessModel.category}</p>
          <Link className="link text-lg font-semibold" href={`/business-models/${project.sourceBusinessModel.id}`}>{project.sourceBusinessModel.title}</Link>
          <div className="mt-2 border-l-2 border-base-300 pl-4"><p className="text-xs font-medium text-base-content/50">运营执行建议</p><p className="mt-1 whitespace-pre-wrap leading-6 text-base-content/70">{project.sourceRequest.suggestion.content}</p></div>
        </div></section>

        <section aria-labelledby="workspace-title" className="card card-border bg-base-100"><div className="card-body p-5">
          <h2 className="card-title" id="workspace-title">执行工作区</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <WorkspacePlaceholder title="任务待办" text="将在下一阶段接入分派、完成与验收。" />
            <WorkspacePlaceholder title="项目文件" text="将在文件阶段接入图片和附件。" />
            <WorkspacePlaceholder title="协作讨论" text="项目群已建立，消息能力将在后续接入。" />
          </div>
        </div></section>

        <ProjectTimeline events={project.events} />
      </div>

      <aside className="space-y-6">
        <section aria-labelledby="members-title" className="card card-border bg-base-100"><div className="card-body p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="card-title" id="members-title">项目成员</h2><span className="badge">{project.members.length} 人</span></div>
          <ul className="mt-2 list">
            {project.members.map(({ id: membershipId, role, user: member }) => <li className="list-row px-0" key={membershipId}>
              <div aria-hidden="true" className="flex size-9 items-center justify-center rounded-field bg-base-200 font-semibold">{member.name.slice(0, 1)}</div>
              <div><p className="font-medium">{member.name}</p><p className="text-xs text-base-content/55">{member.department?.name ?? "未分配部门"}</p></div>
              {role === "LEAD" ? <span className="badge badge-sm">负责人</span> : null}
            </li>)}
          </ul>
        </div></section>

        <section aria-labelledby="departments-title" className="card card-border bg-base-100"><div className="card-body p-5">
          <h2 className="card-title" id="departments-title">参与部门</h2>
          <div className="mt-2 flex flex-wrap gap-2">{project.departments.length ? project.departments.map(({ department }) => <span className="badge badge-lg badge-ghost" key={department.id}>{department.name}</span>) : <p className="text-sm text-base-content/55">暂无参与部门。</p>}</div>
        </div></section>
      </aside>
    </div>

    {options ? <ProjectManagementPanel
      availableDepartments={options.departments.filter(({ id: departmentId }) => !departmentIds.has(departmentId)).map((department) => ({ id: department.id, label: `${department.name} · ${department.code}` }))}
      availableUsers={options.users.filter(({ id: userId }) => !memberIds.has(userId)).map((candidate) => ({ id: candidate.id, label: `${candidate.name} · ${candidate.department?.name ?? "未分配部门"}` }))}
      departments={project.departments.map(({ department }) => ({ id: department.id, label: department.name }))}
      members={project.members.map(({ user: member, role }) => ({ id: member.id, label: `${member.name} · ${member.department?.name ?? "未分配部门"}`, isLead: role === "LEAD" }))}
      projectId={project.id}
      revision={project.revision}
      status={project.status}
    /> : null}
  </div>;
}

function WorkspacePlaceholder({ title, text }: { title: string; text: string }) {
  return <div className="rounded-box border border-dashed border-base-300 bg-base-200/40 p-4"><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-base-content/60">{text}</p></div>;
}
