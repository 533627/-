"use client";

import { useActionState } from "react";

import { transitionTaskAction, type TaskActionState } from "@/features/tasks/actions";

const initialState: TaskActionState = { status: "idle" };

export function TaskActionPanel({
  taskId,
  projectId,
  version,
  status,
  isAssignee,
  canReview,
  hasSubtasks = false,
}: {
  taskId: string;
  projectId: string | null;
  version: number;
  status: "PENDING_ACCEPTANCE" | "ACCEPTED" | "IN_PROGRESS" | "PENDING_REVIEW" | "NEEDS_REVISION" | "COMPLETED";
  isAssignee: boolean;
  canReview: boolean;
  hasSubtasks?: boolean;
}) {
  const [state, action, pending] = useActionState(transitionTaskAction, initialState);
  if (hasSubtasks) return null;
  const common = <>
    <input name="taskId" type="hidden" value={taskId} />
    <input name="projectId" type="hidden" value={projectId ?? ""} />
    <input name="version" type="hidden" value={version} />
  </>;

  let workflowControls: React.ReactNode = null;
  if (isAssignee && status === "PENDING_ACCEPTANCE") workflowControls = <form action={action}>{common}<input name="action" type="hidden" value="ACCEPT" /><button className="btn btn-ghost btn-sm" disabled={pending} type="submit">先接收任务</button></form>;
  if (isAssignee && status === "ACCEPTED") workflowControls = <form action={action}>{common}<input name="action" type="hidden" value="START" /><button className="btn btn-ghost btn-sm" disabled={pending} type="submit">开始执行</button></form>;
  if (isAssignee && (status === "IN_PROGRESS" || status === "NEEDS_REVISION")) workflowControls = <form action={action} className="w-full space-y-2">{common}<input name="action" type="hidden" value="SUBMIT" /><textarea aria-label="成果说明" className="textarea min-h-20 w-full" maxLength={2000} name="note" placeholder="需要组长验收时，可在这里说明成果位置和重点" required /><button className="btn btn-ghost btn-sm" disabled={pending} type="submit">提交组长验收</button></form>;
  if (canReview && status === "PENDING_REVIEW") workflowControls = <div className="grid w-full gap-3 sm:grid-cols-2">
    <form action={action}>{common}<input name="action" type="hidden" value="APPROVE" /><button className="btn btn-success btn-soft btn-sm w-full" disabled={pending} type="submit">验收通过</button></form>
    <form action={action} className="space-y-2">{common}<input name="action" type="hidden" value="REJECT" /><textarea aria-label="退回原因" className="textarea textarea-error min-h-20 w-full" maxLength={2000} name="note" placeholder="必须写明需要修改的内容" required /><button className="btn btn-error btn-soft btn-sm w-full" disabled={pending} type="submit">退回修改</button></form>
  </div>;

  const canComplete = isAssignee && ["PENDING_ACCEPTANCE", "ACCEPTED", "IN_PROGRESS", "NEEDS_REVISION"].includes(status);
  const completeControl = canComplete ? <form action={action}>{common}<input name="action" type="hidden" value="COMPLETE" /><button className="btn btn-success btn-sm" disabled={pending} type="submit">确认完成</button></form> : null;
  const controls = workflowControls || completeControl ? <div className="flex w-full flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="w-full">{workflowControls}</div>{completeControl}</div> : null;

  if (!controls && state.status === "idle") return null;
  return <div className="border-t border-base-300 pt-4">
    {controls}
    <p aria-live="polite" className={`mt-3 text-sm ${state.status === "error" ? "text-error" : "text-success"}`}>{state.status === "idle" ? "" : state.message}</p>
  </div>;
}
