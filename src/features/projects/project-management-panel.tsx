"use client";

import { useActionState } from "react";

import {
  manageProjectAction,
  type ProjectManagementActionState,
} from "@/features/projects/management-actions";

type Option = { id: string; label: string };
type Member = Option & { isLead: boolean };

const initialState: ProjectManagementActionState = { status: "idle" };
const STATUS_LABELS = {
  PREPARING: "准备中",
  IN_PROGRESS: "进行中",
  PAUSED: "已暂停",
  COMPLETED: "已完成",
  ARCHIVED: "已归档",
} as const;
const STATUS_TRANSITIONS = {
  PREPARING: ["IN_PROGRESS", "ARCHIVED"],
  IN_PROGRESS: ["PAUSED", "COMPLETED"],
  PAUSED: ["IN_PROGRESS", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
} as const;

export function ProjectManagementPanel({
  projectId,
  revision,
  status,
  members,
  availableUsers,
  departments,
  availableDepartments,
}: {
  projectId: string;
  revision: number;
  status: keyof typeof STATUS_LABELS;
  members: Member[];
  availableUsers: Option[];
  departments: Option[];
  availableDepartments: Option[];
}) {
  const statusOptions = STATUS_TRANSITIONS[status].map((value) => ({ id: value, label: STATUS_LABELS[value] }));

  return (
    <section aria-labelledby="project-management-title" className="card card-border bg-base-100">
      <div className="card-body gap-5 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-base-content/50">最高管理员</p>
          <h2 className="card-title mt-1" id="project-management-title">项目管理</h2>
          <p className="mt-1 text-sm leading-6 text-base-content/65">成员移除后会立即失去项目详情与后续协作内容的访问权。</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SelectMutationForm
            buttonLabel="更新状态"
            disabledMessage="该项目已没有可继续切换的状态。"
            fieldLabel="项目状态"
            name="status"
            operation="STATUS"
            options={statusOptions}
            projectId={projectId}
            revision={revision}
          />
          <SelectMutationForm
            buttonLabel="交接负责人"
            fieldLabel="新负责人"
            name="targetId"
            operation="LEAD"
            options={members.filter((member) => !member.isLead)}
            projectId={projectId}
            revision={revision}
          />
          <SelectMutationForm
            buttonLabel="添加成员"
            disabledMessage="所有可用账号都已在项目中。"
            fieldLabel="选择员工"
            name="targetId"
            operation="ADD_MEMBER"
            options={availableUsers}
            projectId={projectId}
            revision={revision}
          />
          <SelectMutationForm
            buttonLabel="添加部门"
            disabledMessage="所有启用部门都已参与项目。"
            fieldLabel="选择参与部门"
            name="targetId"
            operation="ADD_DEPARTMENT"
            options={availableDepartments}
            projectId={projectId}
            revision={revision}
          />
        </div>

        <div className="grid gap-4 border-t border-base-300 pt-5 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">移除成员</h3>
            <RemoveMutationList items={members} operation="REMOVE_MEMBER" projectId={projectId} revision={revision} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">移除参与部门</h3>
            <RemoveMutationList emptyMessage="暂无参与部门。" items={departments} operation="REMOVE_DEPARTMENT" projectId={projectId} revision={revision} />
          </div>
        </div>
      </div>
    </section>
  );
}

function SelectMutationForm({
  buttonLabel,
  disabledMessage = "暂无可选项。",
  fieldLabel,
  name,
  operation,
  options,
  projectId,
  revision,
}: {
  buttonLabel: string;
  disabledMessage?: string;
  fieldLabel: string;
  name: "status" | "targetId";
  operation: "STATUS" | "LEAD" | "ADD_MEMBER" | "ADD_DEPARTMENT";
  options: readonly Option[];
  projectId: string;
  revision: number;
}) {
  const [state, action, pending] = useActionState(manageProjectAction, initialState);
  return (
    <form action={action} className="rounded-box border border-base-300 p-4">
      <input name="operation" type="hidden" value={operation} />
      <input name="projectId" type="hidden" value={projectId} />
      <input name="revision" type="hidden" value={revision} />
      <fieldset className="fieldset">
        <legend className="fieldset-legend">{fieldLabel}</legend>
        <select aria-label={fieldLabel} className="select w-full" disabled={!options.length || pending} name={name} required>
          <option value="">请选择</option>
          {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </fieldset>
      <button className="btn btn-sm mt-3" disabled={!options.length || pending} type="submit">
        {pending ? "处理中…" : buttonLabel}
      </button>
      {!options.length ? <p className="mt-2 text-xs text-base-content/55">{disabledMessage}</p> : null}
      <ActionMessage state={state} />
    </form>
  );
}

function RemoveMutationList({ emptyMessage, items, operation, projectId, revision }: {
  emptyMessage?: string;
  items: Array<Option & { isLead?: boolean }>;
  operation: "REMOVE_MEMBER" | "REMOVE_DEPARTMENT";
  projectId: string;
  revision: number;
}) {
  const [state, action, pending] = useActionState(manageProjectAction, initialState);
  if (!items.length) return <p className="mt-2 text-sm text-base-content/55">{emptyMessage ?? "暂无可移除项。"}</p>;
  return <>
    <ul className="mt-2 list rounded-box border border-base-300">
      {items.map((item) => <li className="list-row items-center" key={item.id}>
        <span className="list-col-grow text-sm">{item.label}</span>
        {item.isLead ? <span className="badge badge-sm">负责人</span> : <form action={action}>
          <input name="operation" type="hidden" value={operation} />
          <input name="projectId" type="hidden" value={projectId} />
          <input name="revision" type="hidden" value={revision} />
          <input name="targetId" type="hidden" value={item.id} />
          <button aria-label={`移除 ${item.label}`} className="btn btn-ghost btn-xs text-error" disabled={pending} type="submit">{pending ? "移除中…" : "移除"}</button>
        </form>}
      </li>)}
    </ul>
    <ActionMessage state={state} />
  </>;
}

function ActionMessage({ state }: { state: ProjectManagementActionState }) {
  if (state.status === "idle") return null;
  return <p aria-live="polite" className={`mt-3 text-xs ${state.status === "error" ? "text-error" : "text-success"}`}>
    {state.message}
  </p>;
}
