"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";

import {
  createDepartmentAction,
  type DepartmentActionState,
} from "@/features/departments/actions";

const initialState: DepartmentActionState = { status: "idle" };

export function DepartmentCreateDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState(createDepartmentAction, initialState);
  return <>
    <button className="btn btn-primary" onClick={() => dialogRef.current?.showModal()} type="button">
      新增部门
    </button>
    <dialog className="modal modal-bottom sm:modal-middle" ref={dialogRef}>
      <div className="modal-box max-w-xl">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-semibold">新增部门</h2><p className="mt-2 text-sm text-base-content/65">部门停用后仍保留成员调动和业务历史，不提供硬删除。</p></div>
          <button aria-label="关闭新增部门窗口" className="btn btn-ghost btn-sm" onClick={() => dialogRef.current?.close()} type="button">关闭</button>
        </div>
        <form action={action} className="mt-6 grid gap-4">
          <label className="fieldset" htmlFor="department-name"><span className="fieldset-legend">部门名称</span><input className="input w-full" id="department-name" maxLength={100} minLength={2} name="name" required /></label>
          <label className="fieldset" htmlFor="department-code"><span className="fieldset-legend">部门编码</span><input autoCapitalize="characters" className="input w-full" id="department-code" maxLength={50} minLength={2} name="code" pattern="[A-Za-z0-9_-]+" required /><span className="label">英文、数字、下划线或短横线，保存时自动转为大写。</span></label>
          {state.status !== "idle" ? <p className={state.status === "error" ? "text-sm text-error" : "text-sm text-success"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
          <div className="modal-action"><CreateButton /></div>
        </form>
      </div>
      <form className="modal-backdrop" method="dialog"><button>关闭</button></form>
    </dialog>
  </>;
}

function CreateButton() {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending} type="submit">{pending ? "正在创建" : "确认创建"}</button>;
}
