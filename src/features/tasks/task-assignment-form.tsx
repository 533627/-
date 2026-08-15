"use client";

import { useActionState, useState } from "react";

import { createTaskAction, type TaskActionState } from "@/features/tasks/actions";

const initialState: TaskActionState = { status: "idle" };

type TaskMemberOption = { id: string; name: string; departmentName: string };
export type TaskProjectOption = { id: string; name: string; members: TaskMemberOption[] };
export type TaskAssignmentInitialValues = {
  projectId?: string;
  assigneeId?: string;
  title?: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  startsAt?: string;
  dueAt?: string;
  subtasks?: Array<{ title: string; description: string }>;
};

type SubtaskDraft = { id: string; title: string; description: string };

export function TaskAssignmentForm({
  projectId,
  members,
  projects,
  standaloneMembers,
  initialValues,
}: {
  projectId?: string;
  members?: TaskMemberOption[];
  projects?: TaskProjectOption[];
  standaloneMembers?: TaskMemberOption[];
  initialValues?: TaskAssignmentInitialValues;
}) {
  const [state, action, pending] = useActionState(createTaskAction, initialState);
  const requestedProjectId = projectId ?? initialValues?.projectId;
  const defaultProjectId = requestedProjectId && (projectId || projects?.some((project) => project.id === requestedProjectId))
    ? requestedProjectId
    : standaloneMembers ? "" : projects?.[0]?.id ?? "";
  const defaultMembers = projectId
    ? members ?? []
    : defaultProjectId
      ? projects?.find((project) => project.id === defaultProjectId)?.members ?? []
      : standaloneMembers ?? [];
  const defaultAssigneeId = defaultMembers.some((member) => member.id === initialValues?.assigneeId)
    ? initialValues?.assigneeId ?? ""
    : "";
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState(defaultAssigneeId);
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>(() => initialValues?.subtasks?.length
    ? initialValues.subtasks.map((subtask, index) => ({ ...subtask, id: `initial-${index}` }))
    : [{ id: "initial-0", title: "", description: "" }]);
  const availableMembers = projectId
    ? members ?? []
    : selectedProjectId
      ? projects?.find((project) => project.id === selectedProjectId)?.members ?? []
      : standaloneMembers ?? [];

  return (
    <form action={action} className="card card-border bg-base-100">
      <div className="card-body gap-4 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-base-content/50">项目任务</p>
          <h2 className="card-title mt-1">{initialValues ? "复用并编辑任务" : "派发新任务"}</h2>
          {initialValues ? <p className="mt-1 text-sm text-base-content/60">已带入昨日任务内容，确认或修改后再发布，不会影响原任务。</p> : null}
        </div>

        {projectId ? <input name="projectId" type="hidden" value={projectId} /> : <fieldset className="fieldset">
          <legend className="fieldset-legend">关联项目</legend>
          <select aria-label="关联项目" className="select w-full" name="projectId" onChange={(event) => { setSelectedProjectId(event.target.value); setSelectedAssigneeId(""); }} value={selectedProjectId}>
            {standaloneMembers ? <option value="">不关联项目（日常任务）</option> : <option value="">请选择已立项项目</option>}
            {projects?.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <p className="label">日常任务可直接派给本组员工；选择项目后也会同步显示在项目中。</p>
        </fieldset>}

        <fieldset className="fieldset">
          <legend className="fieldset-legend">任务标题</legend>
          <input
            aria-label="任务标题"
            className="input w-full"
            defaultValue={initialValues?.title}
            maxLength={200}
            name="title"
            placeholder="例如：完成三版商品主图"
            required
          />
        </fieldset>

        <section aria-labelledby="subtasks-title" className="rounded-box border border-base-300 bg-base-200/45 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold" id="subtasks-title">小任务清单</h3>
              <p className="mt-1 text-sm text-base-content/55">负责人需要逐条确认完成，全部完成后主任务自动完成。</p>
            </div>
            <button
              className="btn btn-outline btn-sm"
              disabled={subtasks.length >= 20}
              onClick={() => setSubtasks((items) => [...items, { id: `draft-${items.length}-${Date.now()}`, title: "", description: "" }])}
              type="button"
            >添加小任务</button>
          </div>
          <input name="subtasksJson" type="hidden" value={JSON.stringify(subtasks.map(({ title, description }) => ({ title, description })))} />
          <div className="mt-4 space-y-3">
            {subtasks.map((subtask, index) => <div className="rounded-box border border-base-300 bg-base-100 p-3" key={subtask.id}>
              <div className="flex items-center justify-between gap-3">
                <span className="badge badge-neutral badge-sm">第 {index + 1} 项</span>
                <button aria-label={`删除第 ${index + 1} 条小任务`} className="btn btn-ghost btn-xs text-error" disabled={subtasks.length === 1} onClick={() => setSubtasks((items) => items.filter((item) => item.id !== subtask.id))} type="button">删除</button>
              </div>
              <input
                aria-label={`第 ${index + 1} 条小任务标题`}
                className="input mt-3 w-full"
                maxLength={200}
                onChange={(event) => setSubtasks((items) => items.map((item) => item.id === subtask.id ? { ...item, title: event.target.value } : item))}
                placeholder="例如：整理商品图片和文案"
                required
                value={subtask.title}
              />
              <textarea
                aria-label={`第 ${index + 1} 条小任务说明`}
                className="textarea mt-2 min-h-16 w-full"
                maxLength={1000}
                onChange={(event) => setSubtasks((items) => items.map((item) => item.id === subtask.id ? { ...item, description: event.target.value } : item))}
                placeholder="可选：补充完成标准或注意事项"
                value={subtask.description}
              />
            </div>)}
          </div>
        </section>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">任务说明</legend>
          <textarea
            aria-label="任务说明"
            className="textarea min-h-24 w-full"
            defaultValue={initialValues?.description}
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
            <select aria-label="优先级" className="select w-full" defaultValue={initialValues?.priority ?? "MEDIUM"} name="priority">
              <option value="LOW">低</option>
              <option value="MEDIUM">普通</option>
              <option value="HIGH">高</option>
              <option value="URGENT">紧急</option>
            </select>
          </fieldset>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="fieldset">
            <legend className="fieldset-legend">开始时间</legend>
            <input aria-label="开始时间" className="input w-full" defaultValue={initialValues?.startsAt} name="startsAt" required type="datetime-local" />
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">结束时间</legend>
            <input aria-label="结束时间" className="input w-full" defaultValue={initialValues?.dueAt} name="dueAt" required type="datetime-local" />
          </fieldset>
          <p className="label sm:col-span-2">按北京时间记录，结束时间必须晚于开始时间和当前时间。</p>
        </div>

        <div className="card-actions items-center justify-between">
          <p
            aria-live="polite"
            className={`text-sm ${state.status === "error" ? "text-error" : "text-success"}`}
          >
            {state.status === "idle" ? "" : state.message}
          </p>
          <button className="btn btn-primary" disabled={pending || !availableMembers.length} type="submit">
            {pending ? "派发中…" : "派发任务"}
          </button>
        </div>
      </div>
    </form>
  );
}
