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
}: {
  taskId: string;
  projectId: string;
  version: number;
  status: "PENDING_ACCEPTANCE" | "ACCEPTED" | "IN_PROGRESS" | "PENDING_REVIEW" | "NEEDS_REVISION" | "COMPLETED";
  isAssignee: boolean;
  canReview: boolean;
}) {
  const [state, action, pending] = useActionState(transitionTaskAction, initialState);
  const common = <>
    <input name="taskId" type="hidden" value={taskId} />
    <input name="projectId" type="hidden" value={projectId} />
    <input name="version" type="hidden" value={version} />
  </>;

  let controls: React.ReactNode = null;
  if (isAssignee && status === "PENDING_ACCEPTANCE") controls = <form action={action}>{common}<input name="action" type="hidden" value="ACCEPT" /><button className="btn btn-sm" disabled={pending} type="submit">接收任务</button></form>;
  if (isAssignee && status === "ACCEPTED") controls = <form action={action}>{common}<input name="action" type="hidden" value="START" /><button className="btn btn-sm" disabled={pending} type="submit">开始执行</button></form>;
  if (isAssignee && (status === "IN_PROGRESS" || status === "NEEDS_REVISION")) controls = <form action={action} className="w-full space-y-2">{common}<input name="action" type="hidden" value="SUBMIT" /><textarea aria-label="成果说明" className="textarea min-h-20 w-full" maxLength={2000} name="note" placeholder="说明已完成的内容、成果位置和需要验收的重点" required /><button className="btn btn-sm" disabled={pending} type="submit">提交验收</button></form>;
  if (canReview && status === "PENDING_REVIEW") controls = <div className="grid w-full gap-3 sm:grid-cols-2">
    <form action={action}>{common}<input name="action" type="hidden" value="APPROVE" /><button className="btn btn-success btn-soft btn-sm w-full" disabled={pending} type="submit">验收通过</button></form>
    <form action={action} className="space-y-2">{common}<input name="action" type="hidden" value="REJECT" /><textarea aria-label="退回原因" className="textarea textarea-error min-h-20 w-full" maxLength={2000} name="note" placeholder="必须写明需要修改的内容" required /><button className="btn btn-error btn-soft btn-sm w-full" disabled={pending} type="submit">退回修改</button></form>
  </div>;

  if (!controls && state.status === "idle") return null;
  return <div className="border-t border-base-300 pt-4">
    {controls}
    <p aria-live="polite" className={`mt-3 text-sm ${state.status === "error" ? "text-error" : "text-success"}`}>{state.status === "idle" ? "" : state.message}</p>
  </div>;
}
