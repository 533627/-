"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { sendConversationMessageAction, type ConversationActionState } from "@/features/conversations/actions";

const initialState: ConversationActionState = { status: "idle" };

export function MessageComposer({ kind, conversationId, operationsTeam = null }: { kind: "department" | "project" | "direct"; conversationId: string; operationsTeam?: "TEAM_ONE" | "TEAM_TWO" | null }) {
  const [state, action] = useActionState(sendConversationMessageAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state]);
  return <form action={action} className="border-t border-base-300 bg-base-100 p-3 sm:p-4" ref={formRef}>
    <input name="kind" type="hidden" value={kind} /><input name="conversationId" type="hidden" value={conversationId} />{operationsTeam ? <input name="operationsTeam" type="hidden" value={operationsTeam} /> : null}
    <fieldset className="fieldset"><legend className="sr-only">输入群聊消息</legend><textarea aria-label="输入群聊消息" className="textarea min-h-20 w-full resize-none" maxLength={2000} name="content" placeholder="输入消息，和相关人员同步进展…" required /></fieldset>
    <div className="mt-2 flex items-center justify-between gap-3"><p className={`text-xs ${state.status === "error" ? "text-error" : "text-base-content/55"}`} role={state.status === "error" ? "alert" : "status"}>{state.message ?? "最多 2000 字"}</p><SendButton /></div>
  </form>;
}

function SendButton() { const { pending } = useFormStatus(); return <button className="btn btn-sm" disabled={pending} type="submit">{pending ? "发送中" : "发送"}</button>; }
