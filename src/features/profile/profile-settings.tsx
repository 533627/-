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
  const [showPasswords, setShowPasswords] = useState(false);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmation = String(data.get("confirmation") ?? "");
    if (newPassword.length < 8 || newPassword.length > 128) {
      setMessage("新密码需要 8 至 128 位字符。");
      setIsPending(false);
      return;
    }
    if (newPassword !== confirmation) {
      setMessage("两次输入的新密码不一致。");
      setIsPending(false);
      return;
    }
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });
      if (result.error) {
        setMessage("修改失败：请确认当前密码正确，并且新密码为 8 至 128 位。");
        return;
      }
      form.reset();
      setMessage("密码修改成功，下次登录请使用新密码；当前页面保持登录。 ");
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
            可以设置自己想要的密码，长度为 8 至 128 位。修改成功后当前页面不会退出。
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="fieldset sm:col-span-2">
            <legend className="fieldset-legend">当前密码</legend>
            <input className="input w-full" name="currentPassword" required type={showPasswords ? "text" : "password"} />
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">新密码</legend>
            <input className="input w-full" name="newPassword" minLength={8} maxLength={128} required type={showPasswords ? "text" : "password"} />
            <p className="label">至少 8 位，最多 128 位</p>
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">再次输入新密码</legend>
            <input className="input w-full" name="confirmation" minLength={8} maxLength={128} required type={showPasswords ? "text" : "password"} />
          </fieldset>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input className="checkbox checkbox-sm" checked={showPasswords} onChange={(event) => setShowPasswords(event.target.checked)} type="checkbox" />
            显示密码
          </label>
          <button className="btn btn-primary" disabled={isPending} type="submit">
            {isPending ? "正在修改" : "确认修改密码"}
          </button>
          {message ? <p className="text-sm" role="status">{message}</p> : null}
        </div>
      </form>
    </div>
  );
}
