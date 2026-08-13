import Link from "next/link";
import { notFound } from "next/navigation";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import { getWorkspaceModule } from "@/features/shell/navigation";

export default async function WorkspaceModulePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const user = await requireCurrentUser();
  const workspaceModule = getWorkspaceModule(workspace, user.role);

  if (!workspaceModule) {
    notFound();
  }

  return (
    <section aria-labelledby="module-title" className="module-page module-header max-w-3xl">
      <span className="badge badge-soft">模块建设中</span>
      <h1
        className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl"
        id="module-title"
      >
        {workspaceModule.label}
      </h1>
      <p className="mt-3 leading-7 text-base-content/70">
        {workspaceModule.description}。当前已完成访问权限和工作区入口，业务功能将在后续阶段接入。
      </p>
      <Link className="btn mt-6" href="/">
        返回工作台
      </Link>
    </section>
  );
}
