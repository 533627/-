"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  createExecutionSuggestionAction,
  createProjectRequestAction,
  type ProjectRequestActionState,
} from "@/features/project-requests/actions";

const initialState: ProjectRequestActionState = { status: "idle" };
const STATUS_LABELS = { PENDING: "待审批", APPROVED: "已批准", REJECTED: "已拒绝" } as const;

type Suggestion = {
  id: string;
  authorId: string;
  content: string;
  createdAt: Date;
  author: { id: string; name: string };
  projectRequest: { id: string; status: "PENDING" | "APPROVED" | "REJECTED"; requestedById: string } | null;
};

type Request = {
  id: string;
  proposedName: string;
  objective: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  createdAt: Date;
  requestedBy: { id: string; name: string };
  reviewedBy: { id: string; name: string } | null;
};

export function ProjectRequestPanel({
  businessModelId,
  isActionable,
  canCreate,
  currentUserId,
  suggestions,
  requests,
}: {
  businessModelId: string;
  isActionable: boolean;
  canCreate: boolean;
  currentUserId: string;
  suggestions: Suggestion[];
  requests: Request[];
}) {
  const availableSuggestions = suggestions.filter(
    (suggestion) => suggestion.authorId === currentUserId && !suggestion.projectRequest,
  );
  return (
    <section className="space-y-5" aria-labelledby="execution-collaboration-title">
      <div>
        <p className="text-sm text-base-content/60">原文之外的运营补充</p>
        <h2 className="mt-1 text-2xl font-semibold" id="execution-collaboration-title">执行建议与立项</h2>
      </div>
      {!isActionable && canCreate ? <div className="alert alert-warning alert-soft" role="status">这条商业模式已冻结，不能再添加建议或提交申请。</div> : null}
      {canCreate && isActionable ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <SuggestionForm businessModelId={businessModelId} />
          <RequestForm businessModelId={businessModelId} suggestions={availableSuggestions} />
        </div>
      ) : null}
      <SuggestionList suggestions={suggestions} />
      {requests.length ? <RequestList requests={requests} /> : null}
    </section>
  );
}

function SuggestionForm({ businessModelId }: { businessModelId: string }) {
  const [state, action] = useActionState(createExecutionSuggestionAction, initialState);
  return <form action={action} className="card card-border bg-base-100"><div className="card-body p-5">
    <h3 className="card-title text-lg">1. 添加执行建议</h3>
    <p className="text-sm text-base-content/60">建议独立保存，不会覆盖上方的商业模式原文。</p>
    <input name="businessModelId" type="hidden" value={businessModelId} />
    <label className="fieldset" htmlFor="execution-suggestion"><span className="fieldset-legend">建议内容</span><textarea className="textarea min-h-32 w-full" id="execution-suggestion" maxLength={10_000} name="content" required /></label>
    <ActionFeedback state={state} />
    <div className="card-actions justify-end"><SubmitButton label="保存执行建议" pendingLabel="正在保存" /></div>
  </div></form>;
}

function RequestForm({ businessModelId, suggestions }: { businessModelId: string; suggestions: Suggestion[] }) {
  const [state, action] = useActionState(createProjectRequestAction, initialState);
  return <form action={action} className="card card-border bg-base-100"><div className="card-body p-5">
    <h3 className="card-title text-lg">2. 提交立项申请</h3>
    <p className="text-sm text-base-content/60">选择一条尚未申请过的本人建议，交由最高管理员审批。</p>
    <input name="businessModelId" type="hidden" value={businessModelId} />
    <label className="fieldset" htmlFor="request-suggestion"><span className="fieldset-legend">执行建议</span><select className="select w-full" disabled={!suggestions.length} id="request-suggestion" name="suggestionId" required><option value="">请选择建议</option>{suggestions.map((suggestion) => <option key={suggestion.id} value={suggestion.id}>{shorten(suggestion.content, 42)}</option>)}</select></label>
    <label className="fieldset" htmlFor="request-name"><span className="fieldset-legend">拟定项目名称</span><input className="input w-full" id="request-name" maxLength={200} name="proposedName" required /></label>
    <label className="fieldset" htmlFor="request-objective"><span className="fieldset-legend">验证目标</span><textarea className="textarea min-h-24 w-full" id="request-objective" maxLength={10_000} name="objective" required /></label>
    {!suggestions.length ? <p className="text-sm text-base-content/55">请先保存一条新的执行建议。</p> : null}
    <ActionFeedback state={state} />
    <div className="card-actions justify-end"><SubmitButton disabled={!suggestions.length} label="提交立项申请" pendingLabel="正在提交" /></div>
  </div></form>;
}

function SuggestionList({ suggestions }: { suggestions: Suggestion[] }) {
  return <section className="card card-border bg-base-100"><div className="card-body p-5"><h3 className="card-title text-lg">执行建议记录</h3>
    {suggestions.length ? <ul className="list">{suggestions.map((suggestion) => <li className="list-row px-0" key={suggestion.id}><div className="list-col-grow"><p className="whitespace-pre-wrap leading-6">{suggestion.content}</p><p className="mt-2 text-xs text-base-content/55">{suggestion.author.name} · {formatDate(suggestion.createdAt)}</p></div>{suggestion.projectRequest ? <span className="badge badge-sm">{STATUS_LABELS[suggestion.projectRequest.status]}</span> : null}</li>)}</ul> : <p className="py-4 text-sm text-base-content/55" role="status">还没有执行建议。</p>}
  </div></section>;
}

function RequestList({ requests }: { requests: Request[] }) {
  return <section className="card card-border bg-base-100"><div className="card-body p-5"><h3 className="card-title text-lg">立项申请记录</h3><ul className="list">{requests.map((request) => <li className="list-row px-0" key={request.id}><div className="list-col-grow"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{request.proposedName}</p><span className="badge badge-sm">{STATUS_LABELS[request.status]}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-base-content/70">{request.objective}</p>{request.rejectionReason ? <p className="mt-2 text-sm text-error">拒绝原因：{request.rejectionReason}</p> : null}<p className="mt-2 text-xs text-base-content/55">{request.requestedBy.name} · {formatDate(request.createdAt)}{request.reviewedBy ? ` · ${request.reviewedBy.name} 审批` : ""}</p></div></li>)}</ul></div></section>;
}

function ActionFeedback({ state }: { state: ProjectRequestActionState }) {
  return state.status === "idle" ? null : <p className={state.status === "error" ? "text-sm text-error" : "text-sm text-success"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>;
}

function SubmitButton({ label, pendingLabel, disabled = false }: { label: string; pendingLabel: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={disabled || pending} type="submit">{pending ? pendingLabel : label}</button>;
}

function shorten(value: string, max: number) { return value.length <= max ? value : `${value.slice(0, max)}…`; }
function formatDate(date: Date) { return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" }).format(date); }
