import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountCreateDialog } from "@/features/accounts/account-create-dialog";
import { AccountRowActions } from "@/features/accounts/account-row-actions";
import { createPrismaAccountStore } from "@/features/accounts/account-store";
import { requireCurrentUser } from "@/features/auth/current-user-server";
import { hasCapability } from "@/lib/authz/permissions";
import type { Actor, OperationsTeam, Role } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "最高管理员",
  OPERATIONS_ADMIN: "运营组长",
  DEPARTMENT_MANAGER: "部门组长",
  EMPLOYEE: "员工",
};
const OPERATIONS_TEAM_LABELS: Record<OperationsTeam, string> = {
  TEAM_ONE: "运营一组",
  TEAM_TWO: "运营二组",
};

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const user = await requireCurrentUser();
  if (!hasCapability(user.role, "ACCOUNT_MANAGE")) notFound();

  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 50) : "";
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const actor: Actor = {
    id: user.id,
    role: user.role,
    departmentId: user.department?.id ?? null,
    operationsTeam: user.operationsTeam,
  };
  const database = getDatabase();
  const [accountPage, departments] = await Promise.all([
    createPrismaAccountStore(database).list(actor, {
      page: Number.isFinite(requestedPage) ? requestedPage : 1,
      pageSize: 20,
      query,
    }),
    database.department.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-base-content/60">账号与密码管理</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            账号终端
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-base-content/70">
            创建部门账号、重置密码和停用人员。所有新密码只在操作成功后显示一次。
          </p>
        </div>
        <AccountCreateDialog actorRole={user.role} departments={departments} />
      </header>

      <section className="card card-border bg-base-100" aria-labelledby="account-list-title">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="card-title" id="account-list-title">
                员工账号
              </h2>
              <p className="mt-1 text-sm text-base-content/60">
                共 {accountPage.pagination.totalItems} 个可管理账号
              </p>
            </div>
            <form className="join w-full sm:w-auto" method="get">
              <label className="sr-only" htmlFor="account-search">
                搜索员工姓名或账号
              </label>
              <input
                className="input join-item min-w-0 grow sm:w-64"
                defaultValue={query}
                id="account-search"
                maxLength={50}
                name="q"
                placeholder="姓名或登录账号"
                type="search"
              />
              <button className="btn join-item" type="submit">
                搜索
              </button>
            </form>
          </div>

          {accountPage.items.length ? (
            <ul className="list mt-5 border-t border-base-300">
              {accountPage.items.map((account) => (
                <li
                  className="list-row grid grid-cols-1 gap-3 border-b border-base-300 px-0 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-2"
                  data-account-id={account.id}
                  key={account.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{account.name}</h3>
                      <span
                        className={`badge badge-sm ${
                          account.isActive
                            ? "badge-success badge-soft"
                            : "badge-ghost"
                        }`}
                      >
                        {account.isActive ? "使用中" : "已停用"}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-sm text-base-content/65">
                      @{account.username ?? "未设置账号"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="badge badge-sm">
                        {ROLE_LABELS[account.role]}
                      </span>
                      <span className="badge badge-sm badge-ghost">
                        {account.department?.name ?? "全公司"}
                      </span>
                      {account.operationsTeam ? (
                        <span className="badge badge-sm badge-info badge-soft">
                          {OPERATIONS_TEAM_LABELS[account.operationsTeam]}
                        </span>
                      ) : null}
                      <span className="text-xs text-base-content/50">
                        创建于 {formatDate(account.createdAt)}
                      </span>
                    </div>
                  </div>
                  <AccountRowActions
                    accountId={account.id}
                    isActive={account.isActive}
                    isCurrentUser={account.id === user.id}
                    username={account.username ?? ""}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-12 text-center" role="status">
              <h3 className="font-semibold">没有找到账号</h3>
              <p className="mt-2 text-sm text-base-content/60">
                尝试更换搜索词，或创建新的员工账号。
              </p>
            </div>
          )}

          {accountPage.pagination.totalPages > 1 ? (
            <nav aria-label="账号分页" className="mt-5 flex items-center justify-end gap-2">
              <PaginationLink
                disabled={accountPage.pagination.page <= 1}
                label="上一页"
                page={accountPage.pagination.page - 1}
                query={query}
              />
              <span className="px-2 text-sm text-base-content/60">
                第 {accountPage.pagination.page} / {accountPage.pagination.totalPages} 页
              </span>
              <PaginationLink
                disabled={
                  accountPage.pagination.page >= accountPage.pagination.totalPages
                }
                label="下一页"
                page={accountPage.pagination.page + 1}
                query={query}
              />
            </nav>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function PaginationLink({
  disabled,
  label,
  page,
  query,
}: {
  disabled: boolean;
  label: string;
  page: number;
  query: string;
}) {
  if (disabled) {
    return (
      <span aria-disabled="true" className="btn btn-sm btn-disabled" role="link">
        {label}
      </span>
    );
  }

  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("q", query);
  return (
    <Link className="btn btn-sm" href={`/accounts?${params.toString()}`}>
      {label}
    </Link>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(date);
}
