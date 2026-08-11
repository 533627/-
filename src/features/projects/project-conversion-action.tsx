"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  convertProjectRequestAction,
  type ProjectConversionActionState,
} from "@/features/projects/actions";

const initialState: ProjectConversionActionState = { status: "idle" };

export function ProjectConversionAction({ requestId }: { requestId: string }) {
  const [state, action] = useActionState(convertProjectRequestAction, initialState);
  return <form action={action} className="mt-4 space-y-3">
    <input name="requestId" type="hidden" value={requestId} />
    <p className="text-sm text-base-content/60">将一次性创建项目、初始成员、参与部门和项目协作群。</p>
    <ConvertButton />
    {state.status !== "idle" ? <div className={`alert alert-soft ${state.status === "error" ? "alert-error" : "alert-success"}`} role={state.status === "error" ? "alert" : "status"}><span>{state.message}</span></div> : null}
  </form>;
}

function ConvertButton() {
  const { pending } = useFormStatus();
  return <button className="btn btn-sm" disabled={pending} type="submit">{pending ? "正在创建项目" : "生成正式项目"}</button>;
}
