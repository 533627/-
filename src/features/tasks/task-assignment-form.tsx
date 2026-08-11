"use client";

import { useActionState } from "react";

import { createTaskAction, type TaskActionState } from "@/features/tasks/actions";

const initialState: TaskActionState = { status: "idle" };

export function TaskAssignmentForm({
  projectId,
  members,
}: {
  projectId: string;
  members: Array<{ id: string; name: string; departmentName: string }>;
}) {
  const [state, action, pending] = useActionState(createTaskAction, initialState);

  return (
    <form action={action} className="card card-border bg-base-100">
      <div className="card-body gap-4 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-base-content/50">项目任务</p>
          <h2 className="card-title mt-1">派发新任务</h2>
        </div>

        <input name="projectId" type="hidden" value={projectId} />

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
            <select aria-label="负责人" className="select w-full" name="assigneeId" required>
              <option value="">请选择项目成员</option>
              {members.map((member) => (
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
          <button className="btn" disabled={pending || !members.length} type="submit">
            {pending ? "派发中…" : "派发任务"}
          </button>
        </div>
      </div>
    </form>
  );
}
