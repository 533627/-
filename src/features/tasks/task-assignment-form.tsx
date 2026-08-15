"use client";

import { useActionState, useState } from "react";

import { createTaskAction, type TaskActionState } from "@/features/tasks/actions";

const initialState: TaskActionState = { status: "idle" };

export function TaskAssignmentForm({
  projectId,
  members,
  projects,
}: {
  projectId?: string;
  members?: Array<{ id: string; name: string; departmentName: string }>;
  projects?: Array<{ id: string; name: string; members: Array<{ id: string; name: string; departmentName: string }> }>;
}) {
  const [state, action, pending] = useActionState(createTaskAction, initialState);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId ?? projects?.[0]?.id ?? "");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const availableMembers = projectId
    ? members ?? []
    : projects?.find((project) => project.id === selectedProjectId)?.members ?? [];

  return (
    <form action={action} className="card card-border bg-base-100">
      <div className="card-body gap-4 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-base-content/50">项目任务</p>
          <h2 className="card-title mt-1">派发新任务</h2>
        </div>

        {projectId ? <input name="projectId" type="hidden" value={projectId} /> : <fieldset className="fieldset">
          <legend className="fieldset-legend">关联项目</legend>
          <select aria-label="关联项目" className="select w-full" name="projectId" onChange={(event) => { setSelectedProjectId(event.target.value); setSelectedAssigneeId(""); }} required value={selectedProjectId}>
            <option value="">请选择已立项项目</option>
            {projects?.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <p className="label">任务会同步显示在对应项目中。</p>
        </fieldset>}

        <fieldset className="fieldset">
          <legend className="fieldset-legend">任务标题</legend>
          <input
            aria-label="任务标题"
            className="input w-full"
            maxLength={200}
            name="title"
            placeholder="例如：完成三版商品主图"
            required
          />
        </fieldset>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">任务说明</legend>
          <textarea
            aria-label="任务说明"
            className="textarea min-h-24 w-full"
            maxLength={4000}
            name="description"
            placeholder="写清交付标准、尺寸、数量或注意事项"
          />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="fieldset">
            <legend className="fieldset-legend">负责人</legend>
            <select aria-label="负责人" className="select w-full" name="assigneeId" onChange={(event) => setSelectedAssigneeId(event.target.value)} required value={selectedAssigneeId}>
              <option value="">请选择项目成员</option>
              {availableMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} · {member.departmentName}
                </option>
              ))}
            </select>
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">优先级</legend>
            <select aria-label="优先级" className="select w-full" defaultValue="MEDIUM" name="priority">
              <option value="LOW">低</option>
              <option value="MEDIUM">普通</option>
              <option value="HIGH">高</option>
              <option value="URGENT">紧急</option>
            </select>
          </fieldset>
        </div>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">截止时间</legend>
          <input aria-label="截止时间" className="input w-full" name="dueAt" required type="datetime-local" />
          <p className="label">按北京时间记录，必须晚于当前时间。</p>
        </fieldset>

        <div className="card-actions items-center justify-between">
          <p
            aria-live="polite"
            className={`text-sm ${state.status === "error" ? "text-error" : "text-success"}`}
          >
            {state.status === "idle" ? "" : state.message}
          </p>
          <button className="btn" disabled={pending || !availableMembers.length || !selectedProjectId} type="submit">
            {pending ? "派发中…" : "派发任务"}
          </button>
        </div>
      </div>
    </form>
  );
}
