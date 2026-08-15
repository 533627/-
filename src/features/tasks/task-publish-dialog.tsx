"use client";

import { useRef, useState } from "react";

import {
  TaskAssignmentForm,
  type TaskAssignmentInitialValues,
  type TaskProjectOption,
} from "@/features/tasks/task-assignment-form";

type YesterdayTaskTemplate = TaskAssignmentInitialValues & {
  id: string;
  projectName: string;
  assigneeName: string;
};

export function TaskPublishDialog({
  projects,
  yesterdayTasks,
}: {
  projects: TaskProjectOption[];
  yesterdayTasks: YesterdayTaskTemplate[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const selectedTemplate = yesterdayTasks.find((task) => task.id === selectedTemplateId);

  return <>
    <button className="btn btn-primary" onClick={() => dialogRef.current?.showModal()} type="button">发布任务</button>
    <dialog aria-labelledby="publish-task-dialog-title" className="modal modal-bottom sm:modal-middle" ref={dialogRef}>
      <div className="modal-box max-h-[92vh] max-w-4xl overflow-y-auto p-0">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-base-300 bg-base-100/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 className="text-xl font-semibold" id="publish-task-dialog-title">发布任务</h2>
            <p className="mt-1 text-sm text-base-content/60">新建任务，或复用你昨天发布的内容后再修改。</p>
          </div>
          <form method="dialog"><button aria-label="关闭发布任务窗口" className="btn btn-circle btn-ghost btn-sm">✕</button></form>
        </div>

        <div className="space-y-5 p-5">
          <section aria-labelledby="yesterday-task-title" className="rounded-box border border-base-300 bg-base-200/55 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold" id="yesterday-task-title">复用昨日任务</h3>
                <p className="mt-1 text-sm text-base-content/60">只显示你昨天发布的任务；复用后，项目、负责人和任务内容都可以修改。</p>
              </div>
              {selectedTemplate ? <button className="btn btn-ghost btn-sm" onClick={() => setSelectedTemplateId(null)} type="button">清空，创建新任务</button> : null}
            </div>

            {yesterdayTasks.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {yesterdayTasks.map((task) => <button
                className={`rounded-box border p-3 text-left transition-colors ${selectedTemplateId === task.id ? "border-primary bg-primary/10" : "border-base-300 bg-base-100 hover:border-primary/45"}`}
                key={task.id}
                onClick={() => setSelectedTemplateId(task.id)}
                type="button"
              >
                <span className="block truncate font-medium">{task.title}</span>
                <span className="mt-1 block truncate text-xs text-base-content/55">{task.projectName} · {task.assigneeName}</span>
                <span className="mt-2 inline-block text-xs font-medium text-primary">复用并修改</span>
              </button>)}
            </div> : <p className="mt-4 text-sm text-base-content/55">昨天没有可复用的任务，可以直接创建新任务。</p>}
          </section>

          {projects.length
            ? <TaskAssignmentForm initialValues={selectedTemplate} key={selectedTemplate?.id ?? "new-task"} projects={projects} />
            : <div className="alert alert-info alert-soft" role="status">目前没有可派单的本组项目成员。请先由最高管理员把员工加入项目，并确认运营分组设置正确。</div>}
        </div>
      </div>
      <form className="modal-backdrop" method="dialog"><button aria-label="关闭发布任务窗口">关闭</button></form>
    </dialog>
  </>;
}
