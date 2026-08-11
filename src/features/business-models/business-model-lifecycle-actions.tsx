"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  transitionBusinessModelAction,
  type BusinessModelActionState,
} from "@/features/business-models/actions";
import type { BusinessModelStatus } from "@/features/business-models/business-model-management";

const initialState: BusinessModelActionState = { status: "idle" };

export function BusinessModelLifecycleActions({ id, revision, status }: { id: string; revision: number; status: BusinessModelStatus }) {
  const [state, action] = useActionState(transitionBusinessModelAction, initialState);
  const next = status === "ACTIVE" ? "ARCHIVED" : status === "ARCHIVED" ? "ACTIVE" : null;
  return <div className="space-y-3">
    {next ? <form action={action} className="flex flex-wrap gap-2">
      <input name="businessModelId" type="hidden" value={id} /><input name="revision" type="hidden" value={revision} /><input name="nextStatus" type="hidden" value={next} />
      <LifecycleButton label={next === "ARCHIVED" ? "归档记录" : "恢复记录"} />
    </form> : null}
    {status === "ARCHIVED" ? <form action={action}>
      <input name="businessModelId" type="hidden" value={id} /><input name="revision" type="hidden" value={revision} /><input name="nextStatus" type="hidden" value="DELETED" />
      <LifecycleButton label="软删除记录" />
    </form> : null}
    {state.status !== "idle" ? <p className={state.status === "error" ? "text-sm text-error" : "text-sm text-success"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
  </div>;
}

function LifecycleButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn btn-sm" disabled={pending} type="submit">{pending ? "正在处理" : label}</button>;
}
