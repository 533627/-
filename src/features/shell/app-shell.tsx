import type { ReactNode } from "react";

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
        <header className="navbar sticky top-0 z-10 min-h-16 border-b border-base-300 bg-base-100 px-4 lg:px-8">
          <div className="navbar-start gap-3">
            <WorkspaceDrawerButton />
            <div className="lg:hidden">
              <p className="font-semibold leading-tight">{appConfig.name}</p>
              <p className="text-xs text-base-content/60">
                {user.department?.name ?? "全公司工作区"}
              </p>
            </div>
          </div>
          <div className="navbar-end hidden text-right sm:block">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-base-content/60">
              {ROLE_LABELS[user.role]}
            </p>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
      <div className="drawer-side z-20">
        <label
          aria-label="关闭菜单"
          className="drawer-overlay"
          htmlFor="workspace-drawer"
        />
        <aside className="flex min-h-full w-72 flex-col border-r border-base-300 bg-base-100 p-4 text-base-content">
          <Brand />
          <nav aria-label="主导航" className="mt-7 grow">
            <WorkspaceNavigation items={navigation} />
          </nav>
          <div className="border-t border-base-300 pt-4">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="mt-1 truncate text-xs text-base-content/60">
              @{user.username}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="badge badge-sm">{ROLE_LABELS[user.role]}</span>
              <span className="badge badge-sm badge-ghost">
                {user.department?.name ?? "全公司"}
              </span>
            </div>
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
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center rounded-field bg-neutral font-semibold text-neutral-content"
      >
        商
      </span>
      <div>
        <p className="font-semibold leading-tight">{appConfig.name}</p>
        <p className="mt-1 text-xs text-base-content/60">公司内部运营平台</p>
      </div>
    </div>
  );
}
