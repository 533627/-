import Link from "next/link";

import { TaskAssignmentForm } from "@/features/tasks/task-assignment-form";
import { formatTaskDate, TASK_STATUS_BADGES, TASK_STATUS_LABELS } from "@/features/tasks/task-labels";

export function ProjectTaskPanel({ projectId, summary, tasks, assignableMembers }: {
  projectId: string;
  summary: { total: number; completed: number; pendingReview: number; overdue: number; completionRate: number };
  tasks: Array<{ id: string; title: string; status: keyof typeof TASK_STATUS_LABELS; isOverdue: boolean; dueAt: Date; assignee: { name: string } }>;
  assignableMembers: Array<{ id: string; name: string; departmentName: string }> | null;
}) {
  return <section aria-labelledby="project-tasks-title" className="space-y-4">
    <div className="card card-border bg-base-100"><div className="card-body p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="card-title" id="project-tasks-title">项目任务</h2><p className="mt-1 text-sm text-base-content/60">只有验收通过的任务计入完成率。</p></div><Link className="btn btn-ghost btn-sm" href="/tasks">进入任务中心</Link></div>
      <div className="mt-3 flex items-end justify-between gap-3"><div><span className="text-3xl font-semibold">{summary.completionRate}%</span><span className="ml-2 text-sm text-base-content/55">{summary.completed}/{summary.total} 已完成</span></div><div className="text-right text-xs text-base-content/55"><p>{summary.pendingReview} 待验收</p><p className={summary.overdue ? "text-error" : ""}>{summary.overdue} 已逾期</p></div></div>
      <progress aria-label="任务完成率" className="progress mt-2 w-full" max={100} value={summary.completionRate} />
      {tasks.length ? <ul className="mt-4 list border-t border-base-300">{tasks.slice(0, 5).map((task) => <li className="list-row px-0" key={task.id}><div className="list-col-grow"><p className="font-medium">{task.title}</p><p className="mt-1 text-xs text-base-content/55">{task.assignee.name} · 截止 {formatTaskDate(task.dueAt)}</p></div><div className="flex items-center gap-2"><span className={`badge badge-sm ${TASK_STATUS_BADGES[task.status]}`}>{TASK_STATUS_LABELS[task.status]}</span>{task.isOverdue ? <span className="badge badge-error badge-sm">逾期</span> : null}</div></li>)}</ul> : <p className="mt-4 text-sm text-base-content/55">项目暂时没有任务。</p>}
    </div></div>
    {assignableMembers ? <TaskAssignmentForm members={assignableMembers} projectId={projectId} /> : null}
  </section>;
}
