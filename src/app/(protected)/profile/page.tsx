import type { Metadata } from "next";

import { ProfileSettings } from "@/features/profile/profile-settings";
import { requireCurrentUser } from "@/features/auth/current-user-server";
import { hasCapability } from "@/lib/authz/permissions";

export const metadata: Metadata = { title: "个人设置" };

export default async function ProfilePage() {
  const user = await requireCurrentUser();
  return (
    <div className="module-page space-y-8">
      <header className="module-header max-w-3xl">
        <p className="text-sm text-base-content/55">个人账号与安全</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">个人设置</h1>
        <p className="mt-4 text-base leading-7 text-base-content/65">
          修改自己的登录密码，查看当前账号归属和安全说明。
        </p>
      </header>
      <ProfileSettings
        canManageUsername={hasCapability(user.role, "ACCOUNT_MANAGE")}
        username={user.username}
      />
    </div>
  );
}
