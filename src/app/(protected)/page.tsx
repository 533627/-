import Link from "next/link";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import {
  getNavigationForRole,
  getRoleHomeCopy,
} from "@/features/shell/navigation";

export default async function WorkspaceHomePage() {
  const user = await requireCurrentUser();
  const copy = getRoleHomeCopy(user.role);
  const availableModules = getNavigationForRole(user.role).filter(
    ({ href }) => href !== "/",
  );

  return (
    <div className="space-y-8">
      <section aria-labelledby="workspace-title">
        <p className="text-sm text-base-content/60">
          {user.department?.name ?? "全公司工作区"}
        </p>
        <h1
          className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl"
          id="workspace-title"
        >
          {copy.title}
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-base-content/70">
          {copy.description}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <section
          aria-labelledby="available-workspaces"
          className="card card-border bg-base-100"
        >
          <div className="card-body">
            <h2 className="card-title" id="available-workspaces">
              你的工作区
            </h2>
            <div className="mt-2 grid gap-1">
              {availableModules.map((item) => (
                <Link
                  className="group flex items-center justify-between gap-4 rounded-field px-3 py-3 transition-colors hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2"
                  href={item.href}
                  key={item.href}
                >
                  <span>
                    <span className="block font-medium">{item.label}</span>
                    <span className="mt-1 block text-sm text-base-content/60">
                      {item.description}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-base-content/40">
                    前往
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <aside aria-labelledby="identity-title" className="bg-base-200 lg:pt-2">
          <h2 className="text-sm font-semibold" id="identity-title">
            当前身份
          </h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-base-content/60">姓名</dt>
              <dd className="mt-1 font-medium">{user.name}</dd>
            </div>
            <div>
              <dt className="text-base-content/60">登录账号</dt>
              <dd className="mt-1 font-medium">@{user.username}</dd>
            </div>
            <div>
              <dt className="text-base-content/60">所属范围</dt>
              <dd className="mt-1 font-medium">
                {user.department?.name ?? "全公司"}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
