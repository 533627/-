"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createDirectProjectAction, type ProjectConversionActionState } from "@/features/projects/actions";

const initialState: ProjectConversionActionState = { status: "idle" };

export function DirectProjectForm({ businessModelId, defaultName, leads }: {
  businessModelId: string;
  defaultName: string;
  leads: Array<{ id: string; label: string }>;
}) {
  const [state, action] = useActionState(createDirectProjectAction, initialState);
  return <section className="card card-border bg-base-100" aria-labelledby="direct-project-title">
    <form action={action} className="card-body p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm text-base-content/60">最高管理员决策入口</p><h2 className="card-title mt-1" id="direct-project-title">直接立项</h2></div>
        <span className="badge badge-success badge-soft">无需审批</span>
      </div>
      <p className="text-sm leading-6 text-base-content/65">提交后立即创建项目和项目协作群，再到项目页添加相关人员。</p>
      <input name="businessModelId" type="hidden" value={businessModelId} />
      <fieldset className="fieldset"><legend className="fieldset-legend">项目名称</legend><input className="input w-full" defaultValue={defaultName} maxLength={200} name="name" required /></fieldset>
      <fieldset className="fieldset"><legend className="fieldset-legend">项目负责人</legend><select className="select w-full" name="leadId" required><option value="">请选择负责人</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.label}</option>)}</select></fieldset>
      <fieldset className="fieldset"><legend className="fieldset-legend">项目目标（选填）</legend><textarea className="textarea min-h-24 w-full" maxLength={10_000} name="objective" /></fieldset>
      {state.status !== "idle" ? <div className={`alert alert-soft ${state.status === "error" ? "alert-error" : "alert-success"}`} role={state.status === "error" ? "alert" : "status"}><span>{state.message}</span>{state.status === "success" ? <Link className="link" href={`/projects/${state.projectId}`}>进入项目</Link> : null}</div> : null}
      <div className="card-actions justify-end"><DirectSubmit /></div>
    </form>
  </section>;
}

function DirectSubmit() { const { pending } = useFormStatus(); return <button className="btn" disabled={pending} type="submit">{pending ? "正在建立" : "直接建立项目"}</button>; }
