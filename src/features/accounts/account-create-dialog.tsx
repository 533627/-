"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createAccountAction,
  type AccountActionState,
} from "@/features/accounts/actions";
import { OneTimeCredentials } from "@/features/accounts/one-time-credentials";
import type { Role } from "@/lib/authz/types";

const initialState: AccountActionState = { status: "idle" };
const roleOptions: ReadonlyArray<{ value: Role; label: string }> = [
  { value: "SUPER_ADMIN", label: "最高管理员" },
  { value: "OPERATIONS_ADMIN", label: "运营组长" },
  { value: "DEPARTMENT_MANAGER", label: "部门组长" },
  { value: "EMPLOYEE", label: "员工" },
];

export function AccountCreateDialog({
  actorRole,
  departments,
}: {
  actorRole: Role;
  departments: ReadonlyArray<{ id: string; name: string }>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [role, setRole] = useState<Role>("EMPLOYEE");
  const [state, action] = useActionState(createAccountAction, initialState);
  const availableRoles = roleOptions.filter(
    ({ value }) => actorRole === "SUPER_ADMIN" || value !== "SUPER_ADMIN",
  );

  return (
    <>
      <button
        className="btn btn-primary"
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        创建员工账号
      </button>
      <dialog className="modal modal-bottom sm:modal-middle" ref={dialogRef}>
        <div className="modal-box max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">创建员工账号</h2>
              <p className="mt-2 text-sm leading-6 text-base-content/65">
                账号创建后会生成一次性密码，不要求首次登录强制修改。
              </p>
            </div>
            <button
              aria-label="关闭创建账号窗口"
              className="btn btn-ghost btn-sm"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              关闭
            </button>
          </div>

          <form action={action} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="fieldset sm:col-span-2" htmlFor="account-name">
              <span className="fieldset-legend">员工姓名</span>
              <input
                className="input w-full"
                id="account-name"
                maxLength={100}
                name="name"
                required
              />
            </label>
            <label className="fieldset sm:col-span-2" htmlFor="account-username">
              <span className="fieldset-legend">登录账号</span>
              <input
                autoCapitalize="none"
                className="input w-full"
                id="account-username"
                maxLength={30}
                minLength={3}
                name="username"
                pattern="[A-Za-z0-9_.]+"
                required
                spellCheck={false}
              />
              <span className="label">仅支持英文字母、数字、下划线和英文句点</span>
            </label>
            <label className="fieldset" htmlFor="account-role">
              <span className="fieldset-legend">账号角色</span>
              <select
                className="select w-full"
                id="account-role"
                name="role"
                onChange={(event) => setRole(event.target.value as Role)}
                value={role}
              >
                {availableRoles.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldset" htmlFor="account-department">
              <span className="fieldset-legend">所属部门</span>
              <select
                className="select w-full"
                disabled={role === "SUPER_ADMIN"}
                id="account-department"
                name="departmentId"
                required={role !== "SUPER_ADMIN"}
              >
                <option value="">请选择部门</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>

            {state.status === "error" ? (
              <div className="alert alert-error alert-soft sm:col-span-2" role="alert">
                {state.message}
              </div>
            ) : null}
            {state.status === "success" && state.credentials ? (
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-success">{state.message}</p>
                <OneTimeCredentials {...state.credentials} />
              </div>
            ) : null}

            <div className="modal-action mt-2 sm:col-span-2">
              <CreateSubmitButton />
            </div>
          </form>
        </div>
        <form className="modal-backdrop" method="dialog">
          <button>关闭</button>
        </form>
      </dialog>
    </>
  );
}

function CreateSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" disabled={pending} type="submit">
      {pending ? "正在生成" : "生成账号密码"}
    </button>
  );
}
