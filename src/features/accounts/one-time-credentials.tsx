"use client";

import { useEffect, useRef, useState } from "react";

export function OneTimeCredentials({
  username,
  password,
  presentation = "inline",
}: {
  username: string;
  password: string;
  presentation?: "inline" | "modal";
}) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (presentation === "modal" && !dialogRef.current?.open) {
      dialogRef.current?.showModal();
    }
  }, [presentation, password]);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label}已复制`);
    } catch {
      setCopyMessage("复制失败，请手动选择复制");
    }
  }

  const content = (
    <section
      aria-label="一次性账号密码"
      className={presentation === "modal" ? "block" : "alert alert-warning alert-soft mt-4 block"}
      role="status"
    >
      <p className="text-lg font-semibold">新密码已经生成</p>
      <p className="mt-2 text-sm leading-6 text-base-content/65">
        请立即复制并妥善保存。关闭此窗口或刷新页面后，系统无法再次显示这串密码。
      </p>
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

  if (presentation === "inline") return content;

  return (
    <dialog className="modal" ref={dialogRef}>
      <div className="modal-box max-w-xl">
        {content}
        <form className="modal-action" method="dialog">
          <button className="btn" type="submit">我已保存，关闭</button>
        </form>
      </div>
    </dialog>
  );
}
