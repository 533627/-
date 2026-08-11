"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setIsPending(true);
    setFailed(false);

    try {
      const result = await authClient.signOut();

      if (result.error) {
        setFailed(true);
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        className="btn btn-ghost btn-sm btn-block"
        disabled={isPending}
        onClick={signOut}
        type="button"
      >
        {isPending ? "正在退出" : "退出登录"}
      </button>
      {failed ? (
        <p aria-live="polite" className="mt-2 text-xs text-error">
          退出失败，请重试。
        </p>
      ) : null}
    </div>
  );
}
