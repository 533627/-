import Link from "next/link";
import { notFound } from "next/navigation";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import { ProjectRequestReviewForm } from "@/features/project-requests/project-request-review-form";
import { createPrismaProjectRequestStore } from "@/features/project-requests/project-request-store";
import { hasCapability } from "@/lib/authz/permissions";
import type { Actor } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";

const STATUS_LABELS = { PENDING: "待审批", APPROVED: "已批准", REJECTED: "已拒绝" } as const;
const STATUS_VALUES = ["PENDING", "APPROVED", "REJECTED"] as const;

export default async function ProjectRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireCurrentUser();
  if (!hasCapability(user.role, "PROJECT_REQUEST_REVIEW")) notFound();
  const actor: Actor = { id: user.id, role: user.role, departmentId: user.department?.id ?? null };
  const rawStatus = (await searchParams).status;
  const status = typeof rawStatus === "string" && STATUS_VALUES.some((value) => value === rawStatus)
    ? rawStatus as (typeof STATUS_VALUES)[number]
    : undefined;
  const requests = await createPrismaProjectRequestStore(getDatabase()).listRequests(actor, status);

  return <div className="space-y-6">
    <header><p className="text-sm text-base-content/60">最高管理员决策队列</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">立项审批</h1><p className="mt-3 max-w-2xl leading-7 text-base-content/70">检查商业原文、运营建议和验证目标。批准只进入待建项目状态，项目与协作群将在下一阶段创建。</p></header>
    <nav aria-label="审批状态筛选" className="flex flex-wrap gap-2"><FilterLink active={!status} href="/project-requests">全部</FilterLink>{STATUS_VALUES.map((value) => <FilterLink active={status === value} href={`/project-requests?status=${value}`} key={value}>{STATUS_LABELS[value]}</FilterLink>)}</nav>
    {requests.length ? <ul className="grid gap-5 xl:grid-cols-2">{requests.map((request) => <li className="card card-border bg-base-100" key={request.id}><div className="card-body p-5">
      <div className="flex flex-wrap items-center gap-2"><span className="badge">{STATUS_LABELS[request.status]}</span><span className="badge badge-ghost">{request.businessModel.category}</span></div>
      <h2 className="card-title mt-2">{request.proposedName}</h2>
      <p className="text-sm text-base-content/60">来源：<Link className="link" href={`/business-models/${request.businessModel.id}`}>{request.businessModel.title}</Link></p>
      <div className="mt-2 border-l-2 border-base-300 pl-4"><p className="text-xs font-medium text-base-content/55">运营建议</p><p className="mt-1 whitespace-pre-wrap leading-6">{request.suggestion.content}</p></div>
      <div><p className="text-xs font-medium text-base-content/55">验证目标</p><p className="mt-1 whitespace-pre-wrap leading-6 text-base-content/75">{request.objective}</p></div>
      {request.rejectionReason ? <div className="alert alert-error alert-soft" role="status"><span>拒绝原因：{request.rejectionReason}</span></div> : null}
      <p className="text-xs text-base-content/55">{request.requestedBy.name} 提交 · {formatDate(request.createdAt)}{request.reviewedBy ? ` · ${request.reviewedBy.name} 已审批` : ""}</p>
      {request.status === "PENDING" ? <ProjectRequestReviewForm requestId={request.id} version={request.version} /> : null}
    </div></li>)}</ul> : <div className="card card-border bg-base-100"><div className="card-body items-center py-12 text-center" role="status"><h2 className="font-semibold">当前没有匹配的立项申请</h2><p className="text-sm text-base-content/60">运营组长提交申请后会出现在这里。</p></div></div>}
  </div>;
}

function FilterLink({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return <Link aria-current={active ? "page" : undefined} className={`btn btn-sm ${active ? "btn-active" : "btn-ghost"}`} href={href}>{children}</Link>;
}

function formatDate(date: Date) { return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" }).format(date); }
