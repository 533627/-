import Link from "next/link";
import { notFound } from "next/navigation";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import { BusinessModelForm } from "@/features/business-models/business-model-form";
import { BusinessModelLifecycleActions } from "@/features/business-models/business-model-lifecycle-actions";
import { BusinessModelStoreError, createPrismaBusinessModelStore } from "@/features/business-models/business-model-store";
import { ProjectRequestPanel } from "@/features/project-requests/project-request-panel";
import { DirectProjectForm } from "@/features/projects/direct-project-form";
import { createPrismaProjectStore } from "@/features/projects/project-store";
import { createPrismaProjectRequestStore } from "@/features/project-requests/project-request-store";
import { hasCapability } from "@/lib/authz/permissions";
import type { Actor } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";

const STATUS_LABELS = { ACTIVE: "使用中", ARCHIVED: "已归档", DELETED: "已删除" } as const;
const EVENT_LABELS = { CREATED: "创建原始记录", UPDATED: "更新原始内容", ARCHIVED: "归档记录", RESTORED: "恢复记录", DELETED: "软删除记录" } as const;

export default async function BusinessModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  if (!hasCapability(user.role, "BUSINESS_MODEL_VIEW")) notFound();
  const { id } = await params;
  const actor: Actor = { id: user.id, role: user.role, departmentId: user.department?.id ?? null };
  let record;
  try { record = await createPrismaBusinessModelStore(getDatabase()).get(actor, id); }
  catch (error) { if (error instanceof BusinessModelStoreError && error.code === "BUSINESS_MODEL_NOT_FOUND") notFound(); throw error; }
  const canManage = hasCapability(user.role, "BUSINESS_MODEL_MANAGE");
  const canCreateRequest = user.role !== "SUPER_ADMIN" && hasCapability(user.role, "PROJECT_REQUEST_CREATE");
  const requestContext = await createPrismaProjectRequestStore(getDatabase()).getBusinessModelContext(actor, id);
  const projectOptions = user.role === "SUPER_ADMIN"
    ? await createPrismaProjectStore(getDatabase()).getManagementOptions(actor)
    : null;

  return <div className="space-y-6">
    <nav className="breadcrumbs text-sm" aria-label="面包屑"><ul><li><Link href="/business-models">商业整理</Link></li><li>{record.title}</li></ul></nav>
    <header className="flex flex-col gap-4 border-b border-base-300 pb-6 lg:flex-row lg:items-start lg:justify-between">
      <div><div className="flex flex-wrap items-center gap-2"><span className={`badge ${record.status === "ACTIVE" ? "badge-success badge-soft" : "badge-ghost"}`}>{STATUS_LABELS[record.status]}</span><span className="badge">版本 {record.revision}</span></div><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{record.title}</h1><p className="mt-3 text-sm text-base-content/60">{record.category} · {record.targetPlatform} · {record.updatedBy.name} 更新于 {formatDate(record.updatedAt)}</p></div>
      {canManage ? <BusinessModelLifecycleActions id={record.id} revision={record.revision} status={record.status} /> : null}
    </header>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <main className="space-y-5">
        <ContentSection title="机会说明" content={record.opportunity} />
        <ContentSection title="商业逻辑" content={record.businessLogic} />
        <ContentSection title="执行打法" content={record.executionPlan} />
        <div className="grid gap-5 md:grid-cols-2"><ContentSection title="成本假设" content={record.costAssumptions} empty="暂未填写成本假设" /><ContentSection title="收益假设" content={record.revenueAssumptions} empty="暂未填写收益假设" /></div>
        <ContentSection title="主要风险" content={record.risks} empty="暂未填写风险" />
        {projectOptions && record.status === "ACTIVE" ? <DirectProjectForm businessModelId={record.id} defaultName={record.title} leads={projectOptions.users.map((candidate) => ({ id: candidate.id, label: `${candidate.name} · ${candidate.department?.name ?? "未分配部门"}` }))} /> : null}
        {user.role !== "SUPER_ADMIN" ? <ProjectRequestPanel businessModelId={record.id} canCreate={canCreateRequest} currentUserId={user.id} isActionable={record.status === "ACTIVE"} requests={requestContext.requests} suggestions={requestContext.suggestions} /> : null}
        {canManage && record.status === "ACTIVE" ? <section className="card card-border bg-base-100" aria-labelledby="edit-model-title"><div className="card-body p-4 sm:p-6"><h2 className="card-title" id="edit-model-title">编辑原始内容</h2><p className="text-sm text-base-content/60">保存会生成新版本；旧版本快照不会被覆盖。</p><BusinessModelForm mode="update" values={record} /></div></section> : null}
      </main>
      <aside className="space-y-5">
        <section className="card card-border bg-base-100"><div className="card-body p-5"><h2 className="card-title text-base">标签与关键词</h2><div className="flex flex-wrap gap-2">{record.tags.map((tag) => <span className="badge badge-outline" key={tag}>#{tag}</span>)}</div><div className="flex flex-wrap gap-2">{record.keywords.map((keyword) => <span className="badge badge-ghost" key={keyword}>{keyword}</span>)}</div></div></section>
        {canManage ? <section className="card card-border bg-base-100"><div className="card-body p-5"><h2 className="card-title text-base">版本记录</h2><ul className="list">{record.events.map((event) => <li className="list-row px-0" key={event.id}><div><p className="font-medium">v{event.revision} · {EVENT_LABELS[event.type]}</p><p className="mt-1 text-xs text-base-content/55">{event.actor.name} · {formatDate(event.createdAt)}</p></div></li>)}</ul></div></section> : <div className="alert alert-info alert-soft" role="status">你当前拥有只读权限，可以查看原始内容但不能修改。</div>}
      </aside>
    </div>
  </div>;
}

function ContentSection({ title, content, empty = "" }: { title: string; content: string; empty?: string }) { return <section className="card card-border bg-base-100"><div className="card-body p-5 sm:p-6"><h2 className="card-title text-lg">{title}</h2><p className={`whitespace-pre-wrap leading-7 ${content ? "text-base-content/80" : "text-base-content/45"}`}>{content || empty}</p></div></section>; }
function formatDate(date: Date) { return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" }).format(date); }
