import type { ProjectEventType, Prisma } from "@/generated/prisma/client";
import { PROJECT_EVENT_LABELS, PROJECT_STATUS_LABELS, formatProjectDate } from "@/features/projects/project-labels";

export function ProjectTimeline({ events }: { events: Array<{
  id: string;
  type: ProjectEventType;
  revision: number;
  details: Prisma.JsonValue;
  createdAt: Date;
  actor: { name: string };
}> }) {
  return <section aria-labelledby="project-timeline-title" className="card card-border bg-base-100">
    <div className="card-body p-5">
      <h2 className="card-title" id="project-timeline-title">项目时间线</h2>
      <p className="text-sm text-base-content/60">状态、负责人、成员和参与部门的变更都会在这里留痕。</p>
      <ul className="timeline timeline-vertical timeline-compact mt-3">
        {events.map((event) => <li key={event.id}>
          <div className="timeline-middle" aria-hidden="true"><span className="status status-neutral" /></div>
          <div className="timeline-end timeline-box mb-4 w-full border-base-300 bg-base-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{PROJECT_EVENT_LABELS[event.type]}</h3>
              <span className="text-xs text-base-content/50">版本 {event.revision}</span>
            </div>
            <p className="mt-1 text-sm text-base-content/65">{describeEvent(event.type, event.details)}</p>
            <p className="mt-2 text-xs text-base-content/50">{event.actor.name} · {formatProjectDate(event.createdAt)}</p>
          </div>
          <hr className="bg-base-300" />
        </li>)}
      </ul>
    </div>
  </section>;
}

function describeEvent(type: ProjectEventType, value: Prisma.JsonValue) {
  const details = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Prisma.JsonValue>
    : {};
  if (type === "STATUS_CHANGED") {
    const from = typeof details.fromStatus === "string" ? PROJECT_STATUS_LABELS[details.fromStatus as keyof typeof PROJECT_STATUS_LABELS] : undefined;
    const to = typeof details.toStatus === "string" ? PROJECT_STATUS_LABELS[details.toStatus as keyof typeof PROJECT_STATUS_LABELS] : undefined;
    if (from && to) return `${from} → ${to}`;
  }
  return {
    CREATED: "项目空间、初始成员与协作群已同时建立。",
    LEAD_CHANGED: "负责人权限已交接给一名现有项目成员。",
    MEMBER_ADDED: "一名员工获得了项目访问权。",
    MEMBER_REMOVED: "一名成员的项目访问权已被收回，历史记录继续保留。",
    DEPARTMENT_ADDED: "一个部门已加入项目协作范围。",
    DEPARTMENT_REMOVED: "一个部门已退出项目协作范围。",
    STATUS_CHANGED: "项目状态已更新。",
  }[type];
}
