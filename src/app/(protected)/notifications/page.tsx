import Link from "next/link";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import { markAllNotificationsReadAction } from "@/features/notifications/actions";
import { createPrismaNotificationStore } from "@/features/notifications/notification-store";
import { getDatabase } from "@/lib/db";

export default async function NotificationsPage() {
  const user = await requireCurrentUser();
  const notifications = await createPrismaNotificationStore(getDatabase()).list(user.id);

  return <div className="module-page space-y-6">
    <header className="module-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm text-base-content/60">消息与业务动态</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">消息提醒</h1><p className="mt-3 text-sm text-base-content/65">私聊消息、立项审批结果都会集中显示在这里。</p></div>
      {notifications.unreadCount ? <form action={markAllNotificationsReadAction}><button className="btn btn-sm" type="submit">全部标为已读</button></form> : null}
    </header>
    <section className="border-t border-base-content/15">
      {notifications.items.length ? <ul className="divide-y divide-base-content/10">{notifications.items.map((item) => {
        const href = item.type === "DIRECT_MESSAGE" ? `/conversations?kind=direct&id=${item.resourceId}` : "/project-requests";
        return <li className={`grid gap-2 py-5 sm:grid-cols-[0.75rem_1fr_auto] ${item.isRead ? "opacity-60" : ""}`} key={item.id}><span className={`mt-2 size-2 rounded-full ${item.isRead ? "bg-base-content/20" : "bg-primary"}`} aria-hidden="true" /><div><h2 className="font-semibold">{item.title}</h2><p className="mt-1 text-sm leading-6 text-base-content/65">{item.message}</p><p className="mt-2 text-xs text-base-content/45">{formatTime(item.createdAt)}</p></div><Link className="btn btn-sm btn-ghost self-center" href={href}>查看</Link></li>;
      })}</ul> : <div className="py-16 text-center" role="status"><h2 className="font-semibold">暂时没有消息</h2><p className="mt-2 text-sm text-base-content/55">新的私聊或审批结果会出现在这里。</p></div>}
    </section>
  </div>;
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" }).format(date);
}
