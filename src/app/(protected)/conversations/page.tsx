import Link from "next/link";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import { createPrismaConversationStore, ConversationStoreError } from "@/features/conversations/conversation-store";
import { MessageComposer } from "@/features/conversations/message-composer";
import { OPERATIONS_TEAMS, type Actor, type OperationsTeam } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireCurrentUser();
  const actor: Actor = { id: user.id, role: user.role, departmentId: user.department?.id ?? null, operationsTeam: user.operationsTeam };
  const store = createPrismaConversationStore(getDatabase());
  const groups = await store.list(actor);
  const query = await searchParams;
  const requestedKind = query.kind === "project" ? "project" : "department";
  const requestedId = typeof query.id === "string" ? query.id : undefined;
  const requestedTeam = parseOperationsTeam(query.team);
  const fallback = groups.departments[0]
    ? { kind: "department" as const, id: groups.departments[0].id, operationsTeam: groups.departments[0].operationsTeam }
    : groups.projects[0]
      ? { kind: "project" as const, id: groups.projects[0].id }
      : null;
  const selected = requestedId ? { kind: requestedKind, id: requestedId, operationsTeam: requestedKind === "department" ? requestedTeam : null } : fallback;
  let conversation = null;
  if (selected) {
    try { conversation = selected.kind === "project" ? await store.getProject(actor, selected.id) : await store.getDepartment(actor, selected.id, selected.operationsTeam); }
    catch (error) { if (!(error instanceof ConversationStoreError)) throw error; }
  }

  return <div className="space-y-5">
    <header><p className="text-sm text-base-content/60">部门沟通与项目闭环</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">协作群聊</h1><p className="mt-3 text-sm text-base-content/65">部门群按部门归属开放，项目群仅项目成员和最高管理员可进入。</p></header>
    <div className="grid min-h-[38rem] overflow-hidden rounded-box border border-base-300 bg-base-100 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="border-b border-base-300 bg-base-200/50 p-3 lg:border-r lg:border-b-0" aria-label="群聊列表">
        <GroupSection title="部门群">{groups.departments.map((department) => { const params = new URLSearchParams({ kind: "department", id: department.id }); if (department.operationsTeam) params.set("team", department.operationsTeam); return <GroupLink active={conversation?.kind === "department" && conversation.id === department.id && conversation.operationsTeam === department.operationsTeam} href={`/conversations?${params.toString()}`} key={`${department.id}-${department.operationsTeam ?? "department"}`} label={department.name} meta={department.operationsTeam ? "运营内部群" : "部门群"} />; })}</GroupSection>
        <GroupSection title="项目群">{groups.projects.map((project) => <GroupLink active={conversation?.kind === "project" && conversation.id === project.id} href={`/conversations?kind=project&id=${project.id}`} key={project.id} label={project.name} meta="项目协作" />)}</GroupSection>
      </aside>
      {conversation ? <section className="flex min-h-[38rem] min-w-0 flex-col" aria-labelledby="conversation-title">
        <header className="border-b border-base-300 px-4 py-3 sm:px-5"><h2 className="font-semibold" id="conversation-title">{conversation.name}</h2><p className="text-xs text-base-content/55">{conversation.subtitle}</p></header>
        <div className="flex-1 space-y-3 overflow-y-auto bg-base-200/30 p-4 sm:p-5" aria-live="polite">
          {conversation.messages.length ? conversation.messages.map((message) => <div className={`chat ${message.authorId === user.id ? "chat-end" : "chat-start"}`} key={message.id}><div className="chat-header mb-1 text-xs text-base-content/55">{message.author.name} · {formatTime(message.createdAt)}</div><div className={`chat-bubble whitespace-pre-wrap ${message.authorId === user.id ? "chat-bubble-neutral" : ""}`}>{message.content}</div></div>) : <div className="flex h-full items-center justify-center text-center" role="status"><div><p className="font-medium">群聊已经开放</p><p className="mt-1 text-sm text-base-content/55">发送第一条消息，开始同步工作。</p></div></div>}
        </div>
        <MessageComposer conversationId={conversation.id} kind={conversation.kind} operationsTeam={conversation.kind === "department" ? conversation.operationsTeam : null} />
      </section> : <div className="flex min-h-[38rem] items-center justify-center p-8 text-center" role="status"><div><h2 className="font-semibold">没有可进入的群聊</h2><p className="mt-2 text-sm text-base-content/55">加入部门或项目后，群聊会显示在这里。</p></div></div>}
    </div>
  </div>;
}

function GroupSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mb-5"><h2 className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-base-content/50">{title}</h2><div className="space-y-1">{children}</div></section>; }
function GroupLink({ active, href, label, meta }: { active: boolean; href: string; label: string; meta: string }) { return <Link aria-current={active ? "page" : undefined} className={`block rounded-field px-3 py-2.5 ${active ? "bg-base-100 font-medium" : "hover:bg-base-100/70"}`} href={href}><span className="block truncate text-sm">{label}</span><span className="mt-0.5 block text-xs text-base-content/45">{meta}</span></Link>; }
function formatTime(date: Date) { return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" }).format(date); }
function parseOperationsTeam(value: string | string[] | undefined): OperationsTeam | null { return typeof value === "string" && OPERATIONS_TEAMS.includes(value as OperationsTeam) ? value as OperationsTeam : null; }
