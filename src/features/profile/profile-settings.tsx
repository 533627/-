"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

export function ProfileSettings({
  username,
  canManageUsername,
}: {
  username: string;
  canManageUsername: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmation = String(data.get("confirmation") ?? "");
    if (newPassword !== confirmation) {
      setMessage("两次输入的新密码不一致。");
      setIsPending(false);
      return;
    }
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setMessage("当前密码不正确，或新密码不符合要求。");
        return;
      }
      form.reset();
      setMessage("密码修改成功，其他设备上的登录已经退出。");
      router.refresh();
    } catch {
      setMessage("暂时无法修改密码，请稍后重试。");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
      <aside className="border-t border-base-content pt-4">
        <p className="text-sm text-base-content/55">当前登录账号</p>
        <p className="mt-2 text-xl font-semibold">@{username}</p>
        <p className="mt-3 text-sm leading-6 text-base-content/60">
          {canManageUsername
            ? "如需修改登录账号，请前往账号终端操作。"
            : "登录账号由最高管理员或运营组长统一管理。"}
        </p>
      </aside>

      <form className="border-t border-base-content pt-4" onSubmit={changePassword}>
        <div className="mb-5">
          <h2 className="text-lg font-semibold">修改我的密码</h2>
          <p className="mt-1 text-sm text-base-content/60">
            新密码至少 12 位。修改后，其他设备上的会话会被退出。
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="fieldset sm:col-span-2">
            <legend className="fieldset-legend">当前密码</legend>
            <input className="input w-full" name="currentPassword" minLength={12} required type="password" />
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">新密码</legend>
            <input className="input w-full" name="newPassword" minLength={12} maxLength={128} required type="password" />
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">再次输入新密码</legend>
            <input className="input w-full" name="confirmation" minLength={12} maxLength={128} required type="password" />
          </fieldset>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button className="btn btn-primary" disabled={isPending} type="submit">
            {isPending ? "正在修改" : "确认修改密码"}
          </button>
          {message ? <p className="text-sm" role="status">{message}</p> : null}
        </div>
      </form>
    </div>
  );
}
