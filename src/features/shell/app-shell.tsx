import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import { appConfig } from "@/lib/app-config";
import type { CurrentUser } from "@/features/auth/current-user";
import { LogoutButton } from "@/features/auth/logout-button";
import { getNavigationForRole } from "@/features/shell/navigation";
import {
  WorkspaceDrawerButton,
  WorkspaceNavigation,
} from "@/features/shell/workspace-navigation";

const ROLE_LABELS = {
  SUPER_ADMIN: "最高管理员",
  OPERATIONS_ADMIN: "运营组长",
  DEPARTMENT_MANAGER: "部门组长",
  EMPLOYEE: "员工",
} as const;

export function AppShell({
  children,
  user,
}: {
  children: ReactNode;
  user: CurrentUser;
}) {
  const navigation = getNavigationForRole(user.role);

  return (
    <div className="drawer min-h-[100dvh] bg-base-200 lg:drawer-open">
      <input
        aria-label="打开工作区导航"
        className="drawer-toggle"
        id="workspace-drawer"
        type="checkbox"
      />
      <div className="drawer-content min-w-0">
        <header className="navbar sticky top-0 z-10 min-h-16 border-b border-base-content/15 bg-base-100 px-4 lg:px-8">
          <div className="navbar-start gap-3">
            <WorkspaceDrawerButton />
            <div className="lg:hidden">
              <p className="font-semibold leading-tight">{appConfig.name}</p>
              <p className="text-xs text-base-content/60">
                {user.department?.name ?? "全公司工作区"}
              </p>
            </div>
          </div>
          <div className="navbar-end gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-xs text-base-content/55">{ROLE_LABELS[user.role]}</p>
            </div>
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
            >
              {user.name.slice(0, 1)}
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
      <div className="drawer-side z-20">
        <label
          aria-label="关闭菜单"
          className="drawer-overlay"
          htmlFor="workspace-drawer"
        />
        <aside className="flex min-h-full w-72 flex-col bg-neutral p-4 text-neutral-content">
          <Brand />
          <nav aria-label="主导航" className="mt-7 grow">
            <WorkspaceNavigation items={navigation} />
          </nav>
          <div className="border-t border-neutral-content/12 px-2 pt-4">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="mt-1 truncate text-xs text-neutral-content/55">
              @{user.username}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="badge badge-sm border-0 bg-primary text-primary-content">{ROLE_LABELS[user.role]}</span>
              <span className="badge badge-sm border-neutral-content/15 bg-transparent text-neutral-content/70">
                {user.department?.name ?? "全公司"}
              </span>
            </div>
            <Link className="btn btn-ghost btn-sm btn-block mt-3" href="/profile">
              个人设置
            </Link>
            <LogoutButton />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2 pt-1">
      <Image alt="" aria-hidden="true" className="size-10 object-contain" height={40} src="/brand-logo.png" width={40} />
      <div>
        <p className="font-semibold leading-tight text-neutral-content">{appConfig.name}</p>
        <p className="mt-1 text-xs text-neutral-content/50">电商项目指挥台</p>
      </div>
    </div>
  );
}
