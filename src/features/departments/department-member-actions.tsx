"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  setDepartmentActiveAction,
  transferDepartmentMemberAction,
  type DepartmentActionState,
} from "@/features/departments/actions";

const initialState: DepartmentActionState = { status: "idle" };

export function DepartmentStatusAction({ departmentId, isActive }: { departmentId: string; isActive: boolean }) {
  const [state, action] = useActionState(setDepartmentActiveAction, initialState);
  return <div>
    <form action={action}>
      <input name="departmentId" type="hidden" value={departmentId} />
      <input name="nextIsActive" type="hidden" value={isActive ? "false" : "true"} />
      <SubmitButton label={isActive ? "停用部门" : "启用部门"} pendingLabel="正在处理" />
    </form>
    <ActionMessage state={state} />
  </div>;
}

export function MemberTransferAction({ memberId, departments }: { memberId: string; currentDepartmentId: string; departments: ReadonlyArray<{ id: string; name: string; code: string }> }) {
  const [state, action] = useActionState(transferDepartmentMemberAction, initialState);
  const [departmentId, setDepartmentId] = useState("");
  const isOperationsDepartment = departments.find(({ id }) => id === departmentId)?.code === "OPERATIONS";
  return <div className="list-col-wrap mt-3 border-t border-base-300 pt-3">
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      <input name="memberId" type="hidden" value={memberId} />
      <label className="sr-only" htmlFor={`transfer-${memberId}`}>调动到</label>
      <select className="select select-sm min-w-0 grow" id={`transfer-${memberId}`} name="departmentId" onChange={(event) => setDepartmentId(event.target.value)} required value={departmentId}>
        <option disabled value="">选择目标部门</option>
        {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
      </select>
      {isOperationsDepartment ? <select aria-label="选择运营分组" className="select select-sm min-w-0 grow" name="operationsTeam" required defaultValue=""><option disabled value="">选择运营分组</option><option value="TEAM_ONE">运营一组</option><option value="TEAM_TWO">运营二组</option></select> : null}
      <SubmitButton label="确认调动" pendingLabel="正在调动" />
    </form>
    <ActionMessage state={state} />
  </div>;
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return <button className="btn btn-sm" disabled={pending} type="submit">{pending ? pendingLabel : label}</button>;
}

function ActionMessage({ state }: { state: DepartmentActionState }) {
  return state.status === "idle" ? null : <p className={state.status === "error" ? "mt-2 text-sm text-error" : "mt-2 text-sm text-success"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>;
}
