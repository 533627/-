"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";

import {
  createBusinessModelAction,
  updateBusinessModelAction,
  type BusinessModelActionState,
} from "@/features/business-models/actions";

const initialState: BusinessModelActionState = { status: "idle" };

export type BusinessModelFormValues = {
  id?: string;
  revision?: number;
  title: string;
  category: string;
  targetPlatform: string;
  opportunity: string;
  businessLogic: string;
  executionPlan: string;
  costAssumptions: string;
  revenueAssumptions: string;
  risks: string;
  tags: string[];
  keywords: string[];
};

export function BusinessModelCreateDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return <>
    <button className="btn btn-primary" onClick={() => dialogRef.current?.showModal()} type="button">记录商业模式</button>
    <dialog className="modal modal-bottom sm:modal-middle" ref={dialogRef}>
      <div className="modal-box max-h-[92vh] max-w-4xl overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-semibold">记录商业模式</h2><p className="mt-2 text-sm text-base-content/65">先保存原始判断和打法，运营建议将在下一阶段单独记录。</p></div>
          <button aria-label="关闭商业模式窗口" className="btn btn-ghost btn-sm" onClick={() => dialogRef.current?.close()} type="button">关闭</button>
        </div>
        <BusinessModelForm mode="create" />
      </div>
      <form className="modal-backdrop" method="dialog"><button>关闭</button></form>
    </dialog>
  </>;
}

export function BusinessModelForm({ mode, values }: { mode: "create" | "update"; values?: BusinessModelFormValues }) {
  const [state, action] = useActionState(
    mode === "create" ? createBusinessModelAction : updateBusinessModelAction,
    initialState,
  );
  return <form action={action} className="mt-6 grid gap-4 sm:grid-cols-2">
    {values?.id ? <><input name="businessModelId" type="hidden" value={values.id} /><input name="revision" type="hidden" value={values.revision} /></> : null}
    <Field label="标题（必填）" name="title" defaultValue={values?.title} maxLength={200} required className="sm:col-span-2" />
    <div className="alert alert-info alert-soft sm:col-span-2" role="status">除标题外均可稍后补充，先把想法保存下来即可。</div>
    <Field label="行业 / 类目（选填）" name="category" defaultValue={values?.category} maxLength={100} />
    <Field label="目标平台（选填）" name="targetPlatform" defaultValue={values?.targetPlatform} maxLength={100} />
    <LongField label="机会说明（选填）" name="opportunity" defaultValue={values?.opportunity} className="sm:col-span-2" />
    <LongField label="商业逻辑（选填）" name="businessLogic" defaultValue={values?.businessLogic} className="sm:col-span-2" />
    <LongField label="执行打法（选填）" name="executionPlan" defaultValue={values?.executionPlan} className="sm:col-span-2" />
    <LongField label="成本假设" name="costAssumptions" defaultValue={values?.costAssumptions} />
    <LongField label="收益假设" name="revenueAssumptions" defaultValue={values?.revenueAssumptions} />
    <LongField label="主要风险" name="risks" defaultValue={values?.risks} className="sm:col-span-2" />
    <Field label="标签" name="tags" defaultValue={values?.tags.join("，")} maxLength={640} help="使用逗号分隔，例如：场景电商，低客单" />
    <Field label="关键词" name="keywords" defaultValue={values?.keywords.join("，")} maxLength={640} help="用于精确筛选，例如：收纳，小红书" />
    {state.status !== "idle" ? <div className={`alert alert-soft sm:col-span-2 ${state.status === "error" ? "alert-error" : "alert-success"}`} role={state.status === "error" ? "alert" : "status"}>{state.message}{state.status === "success" && state.recordId ? <a className="link ml-auto" href={`/business-models/${state.recordId}`}>查看详情</a> : null}</div> : null}
    <div className="flex justify-end sm:col-span-2"><SubmitButton label={mode === "create" ? "保存原始记录" : "保存新版本"} /></div>
  </form>;
}

function Field({ label, name, help, className = "", ...input }: { label: string; name: string; help?: string; className?: string; defaultValue?: string; maxLength: number; required?: boolean }) {
  return <label className={`fieldset ${className}`} htmlFor={`model-${name}`}><span className="fieldset-legend">{label}</span><input className="input w-full" id={`model-${name}`} name={name} {...input} />{help ? <span className="label">{help}</span> : null}</label>;
}

function LongField({ label, name, className = "", ...input }: { label: string; name: string; className?: string; defaultValue?: string; required?: boolean }) {
  return <label className={`fieldset ${className}`} htmlFor={`model-${name}`}><span className="fieldset-legend">{label}</span><textarea className="textarea min-h-28 w-full" id={`model-${name}`} maxLength={10_000} name={name} {...input} /></label>;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending} type="submit">{pending ? "正在保存" : label}</button>;
}
