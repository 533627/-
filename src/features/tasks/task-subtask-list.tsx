"use client";

import { useActionState } from "react";

import { completeSubtaskAction, type TaskActionState } from "@/features/tasks/actions";
import { formatTaskDate } from "@/features/tasks/task-labels";

const initialState: TaskActionState = { status: "idle" };

export function TaskSubtaskList({
  taskId,
  projectId,
  subtasks,
  isAssignee,
}: {
  taskId: string;
  projectId: string | null;
  subtasks: Array<{
    id: string;
    title: string;
    description: string;
    isCompleted: boolean;
    completedAt: Date | null;
    completedBy: { name: string } | null;
  }>;
  isAssignee: boolean;
}) {
  const [state, action, pending] = useActionState(completeSubtaskAction, initialState);
  const completed = subtasks.filter((subtask) => subtask.isCompleted).length;
  const progress = subtasks.length ? Math.round((completed / subtasks.length) * 100) : 0;

  if (!subtasks.length) return null;
  return <section aria-label="小任务清单" className="rounded-box border border-base-300 bg-base-200/45 p-4">
    <div className="flex items-end justify-between gap-3">
      <div><h3 className="font-semibold">小任务进度</h3><p className="mt-1 text-sm text-base-content/55">{completed}/{subtasks.length} 已完成</p></div>
      <span className="text-2xl font-semibold">{progress}%</span>
    </div>
    <progress aria-label="小任务完成进度" className="progress progress-primary mt-3 w-full" max={100} value={progress} />
    <ul className="mt-4 space-y-2">
      {subtasks.map((subtask, index) => <li className="rounded-box border border-base-300 bg-base-100 p-3" key={subtask.id}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><span className={`badge badge-sm ${subtask.isCompleted ? "badge-success" : "badge-ghost"}`}>{subtask.isCompleted ? "已完成" : `第 ${index + 1} 项`}</span><p className={`font-medium ${subtask.isCompleted ? "text-base-content/55 line-through" : ""}`}>{subtask.title}</p></div>
            {subtask.description ? <p className="mt-1 whitespace-pre-wrap text-sm text-base-content/60">{subtask.description}</p> : null}
            {subtask.completedAt ? <p className="mt-1 text-xs text-base-content/45">{subtask.completedBy?.name ?? "负责人"} · {formatTaskDate(subtask.completedAt)}</p> : null}
          </div>
          {isAssignee && !subtask.isCompleted ? <form action={action}>
            <input name="subtaskId" type="hidden" value={subtask.id} />
            <input name="taskId" type="hidden" value={taskId} />
            <input name="projectId" type="hidden" value={projectId ?? ""} />
            <button className="btn btn-success btn-sm" disabled={pending} type="submit">确认完成</button>
          </form> : null}
        </div>
      </li>)}
    </ul>
    <p aria-live="polite" className={`mt-3 text-sm ${state.status === "error" ? "text-error" : "text-success"}`}>{state.status === "idle" ? "" : state.message}</p>
  </section>;
}
