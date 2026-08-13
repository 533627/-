"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  resetAccountPasswordAction,
  setAccountActiveAction,
  updateAccountUsernameAction,
  type AccountActionState,
} from "@/features/accounts/actions";
import { OneTimeCredentials } from "@/features/accounts/one-time-credentials";

const initialState: AccountActionState = { status: "idle" };

export function AccountRowActions({
  accountId,
  isActive,
  isCurrentUser,
  username,
}: {
  accountId: string;
  isActive: boolean;
  isCurrentUser: boolean;
  username: string;
}) {
  const [resetState, resetAction] = useActionState(
    resetAccountPasswordAction,
    initialState,
  );
  const [statusState, statusAction] = useActionState(
    setAccountActiveAction,
    initialState,
  );
  const [usernameState, usernameAction] = useActionState(
    updateAccountUsernameAction,
    initialState,
  );

  return (
    <div className="list-col-wrap mt-3 border-t border-base-300 pt-3">
      <div className="flex flex-wrap gap-2">
        <details className="w-full">
          <summary className="btn btn-sm">修改登录账号</summary>
          <form action={usernameAction} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input name="targetId" type="hidden" value={accountId} />
            <label className="sr-only" htmlFor={"username-" + accountId}>新的登录账号</label>
            <input
              className="input input-sm min-w-0 grow"
              defaultValue={username}
              id={"username-" + accountId}
              maxLength={30}
              minLength={3}
              name="username"
              pattern="[a-zA-Z0-9_.]+"
              required
            />
            <ActionButton idleLabel="保存账号" pendingLabel="正在保存" />
          </form>
          {usernameState.status !== "idle" ? (
            <p
              className={"mt-2 text-sm " + (usernameState.status === "error" ? "text-error" : "text-success")}
              role={usernameState.status === "error" ? "alert" : "status"}
            >
              {usernameState.message}
            </p>
          ) : null}
        </details>
        <form action={resetAction}>
          <input name="targetId" type="hidden" value={accountId} />
          <ActionButton idleLabel="重置密码" pendingLabel="正在重置" />
        </form>
        <form action={statusAction}>
          <input name="targetId" type="hidden" value={accountId} />
          <input
            name="nextIsActive"
            type="hidden"
            value={isActive ? "false" : "true"}
          />
          <ActionButton
            disabled={isCurrentUser && isActive}
            idleLabel={isActive ? "停用账号" : "启用账号"}
            pendingLabel="正在处理"
          />
        </form>
      </div>

      {resetState.status === "success" && resetState.credentials ? (
        <OneTimeCredentials {...resetState.credentials} presentation="modal" />
      ) : null}
      {resetState.status === "error" ? (
        <p className="mt-3 text-sm text-error" role="alert">
          {resetState.message}
        </p>
      ) : null}
      {statusState.status !== "idle" ? (
        <p
          className={`mt-3 text-sm ${
            statusState.status === "error" ? "text-error" : "text-success"
          }`}
          role={statusState.status === "error" ? "alert" : "status"}
        >
          {statusState.message}
        </p>
      ) : null}
    </div>
  );
}

function ActionButton({
  idleLabel,
  pendingLabel,
  disabled = false,
}: {
  idleLabel: string;
  pendingLabel: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className="btn btn-sm"
      disabled={disabled || pending}
      title={disabled ? "不能停用当前正在使用的账号" : undefined}
      type="submit"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
