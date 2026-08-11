"use client";

import { useState } from "react";

export function OneTimeCredentials({
  username,
  password,
}: {
  username: string;
  password: string;
}) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label}已复制`);
    } catch {
      setCopyMessage("复制失败，请手动选择复制");
    }
  }

  return (
    <section
      aria-label="一次性账号密码"
      className="alert alert-warning alert-soft mt-4 block"
      role="status"
    >
      <p className="font-semibold">请现在复制，刷新或离开页面后无法再次查看</p>
      <dl className="mt-3 grid gap-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-[5rem_1fr_auto] sm:items-center">
          <dt>登录账号</dt>
          <dd className="min-w-0 break-all font-mono font-semibold">{username}</dd>
          <button
            className="btn btn-sm"
            onClick={() => copy(username, "账号")}
            type="button"
          >
            复制账号
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-[5rem_1fr_auto] sm:items-center">
          <dt>临时密码</dt>
          <dd
            className="min-w-0 break-all font-mono font-semibold"
            data-testid="one-time-password"
          >
            {password}
          </dd>
          <button
            className="btn btn-sm"
            onClick={() => copy(password, "密码")}
            type="button"
          >
            复制密码
          </button>
        </div>
      </dl>
      <p aria-live="polite" className="mt-2 min-h-5 text-xs">
        {copyMessage}
      </p>
    </section>
  );
}
