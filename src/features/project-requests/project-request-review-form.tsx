"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  reviewProjectRequestAction,
  type ProjectRequestActionState,
} from "@/features/project-requests/actions";

const initialState: ProjectRequestActionState = { status: "idle" };

export function ProjectRequestReviewForm({
  requestId,
  businessModelId,
  version,
}: {
  requestId: string;
  businessModelId: string;
  version: number;
}) {
  const [state, action] = useActionState(reviewProjectRequestAction, initialState);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input name="requestId" type="hidden" value={requestId} />
      <input name="businessModelId" type="hidden" value={businessModelId} />
      <input name="version" type="hidden" value={version} />
      <label className="fieldset" htmlFor={`rejection-${requestId}`}>
        <span className="fieldset-legend">拒绝原因</span>
        <textarea
          className="textarea min-h-24 w-full"
          id={`rejection-${requestId}`}
          maxLength={2_000}
          name="rejectionReason"
          placeholder="拒绝时必填；批准时可留空"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <ReviewButton decision="APPROVED" label="批准申请" />
        <ReviewButton decision="REJECTED" label="拒绝并通知" />
      </div>
      {state.status !== "idle" ? (
        <p className={state.status === "error" ? "text-sm text-error" : "text-sm text-success"} role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function ReviewButton({ decision, label }: { decision: "APPROVED" | "REJECTED"; label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn btn-sm" disabled={pending} name="decision" type="submit" value={decision}>{pending ? "正在处理" : label}</button>;
}
