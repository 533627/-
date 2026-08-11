import Link from "next/link";
import { notFound } from "next/navigation";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import { BusinessModelCreateDialog } from "@/features/business-models/business-model-form";
import { createPrismaBusinessModelStore } from "@/features/business-models/business-model-store";
import { hasCapability } from "@/lib/authz/permissions";
import type { Actor } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";

const STATUS_LABELS = { ACTIVE: "使用中", ARCHIVED: "已归档", DELETED: "已删除" } as const;

export default async function BusinessModelsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireCurrentUser();
  if (!hasCapability(user.role, "BUSINESS_MODEL_VIEW")) notFound();
  const actor: Actor = { id: user.id, role: user.role, departmentId: user.department?.id ?? null };
  const params = await searchParams;
  const value = (key: string, max: number) => typeof params[key] === "string" ? params[key].slice(0, max) : "";
  const requestedPage = Number.parseInt(value("page", 6) || "1", 10);
  const filters = {
    query: value("q", 100), category: value("category", 100), tag: value("tag", 30), keyword: value("keyword", 30),
  };
  const store = createPrismaBusinessModelStore(getDatabase());
  const [recordPage, facets] = await Promise.all([
    store.list(actor, { page: Number.isFinite(requestedPage) ? requestedPage : 1, pageSize: 20, ...filters, includeDeleted: value("deleted", 5) === "true" }),
    store.facets(actor),
  ]);
  const canManage = hasCapability(user.role, "BUSINESS_MODEL_MANAGE");

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm text-base-content/60">项目机会与执行打法</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">商业整理</h1><p className="mt-3 max-w-2xl leading-7 text-base-content/70">把值得验证的生意逻辑分条沉淀，保留每次修改版本，再交给运营补充建议和申请立项。</p></div>
      {canManage ? <BusinessModelCreateDialog /> : null}
    </header>

    <section className="card card-border bg-base-100" aria-labelledby="model-filter-title"><div className="card-body p-4 sm:p-5">
      <h2 className="card-title text-base" id="model-filter-title">筛选记录</h2>
      <form className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" method="get">
        <label className="fieldset xl:col-span-2" htmlFor="model-search"><span className="fieldset-legend">标题 / 类目 / 平台</span><input className="input w-full" defaultValue={filters.query} id="model-search" maxLength={100} name="q" type="search" /></label>
        <FilterSelect label="类目" name="category" options={facets.categories} value={filters.category} />
        <FilterSelect label="标签" name="tag" options={facets.tags} value={filters.tag} />
        <FilterSelect label="关键词" name="keyword" options={facets.keywords} value={filters.keyword} />
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-5"><button className="btn btn-sm" type="submit">应用筛选</button><Link className="btn btn-ghost btn-sm" href="/business-models">清空</Link></div>
      </form>
    </div></section>

    <section aria-labelledby="model-list-title">
      <div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-semibold" id="model-list-title">模式列表</h2><p className="mt-1 text-sm text-base-content/60">共 {recordPage.pagination.totalItems} 条记录</p></div></div>
      {recordPage.items.length ? <ul className="mt-4 grid gap-4 lg:grid-cols-2">
        {recordPage.items.map((record) => <li className="card card-border bg-base-100" key={record.id}><div className="card-body p-5">
          <div className="flex flex-wrap items-center gap-2"><span className={`badge badge-sm ${record.status === "ACTIVE" ? "badge-success badge-soft" : "badge-ghost"}`}>{STATUS_LABELS[record.status]}</span><span className="badge badge-sm">{record.category}</span><span className="badge badge-sm badge-ghost">{record.targetPlatform}</span></div>
          <h3 className="card-title mt-2 text-lg"><Link className="link-hover" href={`/business-models/${record.id}`}>{record.title}</Link></h3>
          <p className="line-clamp-3 leading-6 text-base-content/70">{record.opportunity}</p>
          <div className="flex flex-wrap gap-2">{record.tags.map((tag) => <span className="badge badge-sm badge-outline" key={tag}>#{tag}</span>)}</div>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-base-300 pt-3 text-xs text-base-content/55"><span>版本 {record.revision} · {record.updatedBy.name} 更新</span><span>{formatDate(record.updatedAt)}</span></div>
        </div></li>)}
      </ul> : <div className="card card-border mt-4 bg-base-100"><div className="card-body items-center py-12 text-center" role="status"><h3 className="font-semibold">没有匹配的商业模式</h3><p className="text-sm text-base-content/60">调整筛选条件，或由最高管理员记录新的模式。</p></div></div>}
      {recordPage.pagination.totalPages > 1 ? <nav aria-label="商业模式分页" className="mt-5 flex items-center justify-end gap-2"><PageLink disabled={recordPage.pagination.page <= 1} page={recordPage.pagination.page - 1} params={filters}>上一页</PageLink><span className="text-sm text-base-content/60">{recordPage.pagination.page} / {recordPage.pagination.totalPages}</span><PageLink disabled={recordPage.pagination.page >= recordPage.pagination.totalPages} page={recordPage.pagination.page + 1} params={filters}>下一页</PageLink></nav> : null}
    </section>
  </div>;
}

function FilterSelect({ label, name, options, value }: { label: string; name: string; options: string[]; value: string }) {
  return <label className="fieldset" htmlFor={`model-filter-${name}`}><span className="fieldset-legend">{label}</span><select className="select w-full" defaultValue={value} id={`model-filter-${name}`} name={name}><option value="">全部</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function PageLink({ disabled, page, params, children }: { disabled: boolean; page: number; params: Record<string, string>; children: React.ReactNode }) {
  if (disabled) return <span aria-disabled="true" className="btn btn-disabled btn-sm" role="link">{children}</span>;
  const query = new URLSearchParams({ page: String(page) });
  for (const [key, value] of Object.entries(params)) if (value) query.set(key === "query" ? "q" : key, value);
  return <Link className="btn btn-sm" href={`/business-models?${query.toString()}`}>{children}</Link>;
}

function formatDate(date: Date) { return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" }).format(date); }
