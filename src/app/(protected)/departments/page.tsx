import { notFound } from "next/navigation";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import { DepartmentCreateDialog } from "@/features/departments/department-create-dialog";
import {
  DepartmentStatusAction,
  MemberTransferAction,
} from "@/features/departments/department-member-actions";
import { createPrismaDepartmentStore } from "@/features/departments/department-store";
import { hasCapability } from "@/lib/authz/permissions";
import type { Actor, Role } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "最高管理员",
  OPERATIONS_ADMIN: "运营组长",
  DEPARTMENT_MANAGER: "部门组长",
  EMPLOYEE: "员工",
};

export default async function DepartmentsPage() {
  const user = await requireCurrentUser();
  if (!hasCapability(user.role, "DEPARTMENT_MEMBERS_VIEW")) notFound();
  const actor: Actor = {
    id: user.id,
    role: user.role,
    departmentId: user.department?.id ?? null,
  };
  const departments = await createPrismaDepartmentStore(getDatabase()).list(actor);
  const activeDepartments = departments
    .filter(({ isActive }) => isActive)
    .map(({ id, name }) => ({ id, name }));
  const canManageStructure = hasCapability(user.role, "DEPARTMENT_STRUCTURE_MANAGE");
  const canTransferMembers = hasCapability(user.role, "ACCOUNT_MANAGE");

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm text-base-content/60">组织与成员关系</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">部门管理</h1>
        <p className="mt-3 max-w-2xl leading-7 text-base-content/70">查看部门成员、调整人员归属并保留每次调动记录。员工调离后，原部门群的后续访问会立即失效。</p>
      </div>
      {canManageStructure ? <DepartmentCreateDialog /> : null}
    </header>

    <div className="grid gap-5">
      {departments.map((department) => <section aria-labelledby={`department-${department.id}`} className="card card-border bg-base-100" key={department.id}>
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="card-title" id={`department-${department.id}`}>{department.name}</h2>
                <span className={`badge badge-sm ${department.isActive ? "badge-success badge-soft" : "badge-ghost"}`}>{department.isActive ? "使用中" : "已停用"}</span>
              </div>
              <p className="mt-1 text-sm text-base-content/55">{department.code} · {department.members.length} 名成员</p>
            </div>
            {canManageStructure ? <DepartmentStatusAction departmentId={department.id} isActive={department.isActive} /> : null}
          </div>

          {department.members.length ? <ul className="list mt-5 border-t border-base-300">
            {department.members.map((member) => {
              const lastChange = member.membershipChanges[0];
              return <li className="list-row grid grid-cols-1 gap-3 border-b border-base-300 px-0 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,0.7fr)] sm:px-2" data-member-id={member.id} key={member.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{member.name}</h3><span className={`badge badge-sm ${member.isActive ? "badge-soft" : "badge-ghost"}`}>{member.isActive ? "在职" : "账号停用"}</span></div>
                  <p className="mt-1 break-all text-sm text-base-content/60">@{member.username ?? "未设置账号"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2"><span className="badge badge-sm">{ROLE_LABELS[member.role]}</span>{lastChange ? <span className="text-xs text-base-content/50">{lastChange.fromDepartment?.name ?? "未分配部门"} 调入 · {formatDate(lastChange.changedAt)}</span> : null}</div>
                </div>
                {canTransferMembers && member.role !== "SUPER_ADMIN" ? <MemberTransferAction currentDepartmentId={department.id} departments={activeDepartments} memberId={member.id} /> : null}
              </li>;
            })}
          </ul> : <div className="py-9 text-center" role="status"><h3 className="font-semibold">暂无成员</h3><p className="mt-2 text-sm text-base-content/60">可在账号终端创建员工，或从其他部门调入。</p></div>}
        </div>
      </section>)}
    </div>
  </div>;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(date);
}
