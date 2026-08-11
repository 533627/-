"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

const INVALID_CREDENTIALS_MESSAGE = "账号或密码错误，请重新输入。";
const CONNECTION_ERROR_MESSAGE = "暂时无法连接终端，请稍后重试。";

export function LoginForm() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setErrorMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const username = String(formData.get("username") ?? "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") ?? "");

    try {
      const result = await authClient.signIn.username({ username, password });

      if (result.error) {
        clearPassword(form);
        setErrorMessage(INVALID_CREDENTIALS_MESSAGE);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      clearPassword(form);
      setErrorMessage(CONNECTION_ERROR_MESSAGE);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <fieldset className="fieldset">
        <label className="fieldset-legend" htmlFor="username">
          登录账号
        </label>
        <input
          autoCapitalize="none"
          autoComplete="username"
          className="input w-full"
          disabled={isPending}
          id="username"
          maxLength={30}
          minLength={3}
          name="username"
          required
          spellCheck={false}
          type="text"
        />
        <p className="label">使用管理员发放的员工账号</p>
      </fieldset>

      <fieldset className="fieldset">
        <label className="fieldset-legend" htmlFor="password">
          密码
        </label>
        <input
          autoComplete="current-password"
          className="input w-full"
          disabled={isPending}
          id="password"
          maxLength={128}
          minLength={12}
          name="password"
          required
          type="password"
        />
        <p className="label">初次登录无需强制修改密码</p>
      </fieldset>

      {errorMessage ? (
        <div className="alert alert-error alert-soft" role="alert">
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <button
        className="btn btn-primary btn-block active:translate-y-px"
        disabled={isPending}
        type="submit"
      >
        {isPending ? (
          <>
            <span className="loading loading-spinner loading-sm" />
            正在登录
          </>
        ) : (
          "登录"
        )}
      </button>
    </form>
  );
}

function clearPassword(form: HTMLFormElement) {
  const passwordInput = form.elements.namedItem("password");

  if (passwordInput instanceof HTMLInputElement) {
    passwordInput.value = "";
    passwordInput.focus();
  }
}
