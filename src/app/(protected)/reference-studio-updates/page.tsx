import { notFound } from "next/navigation";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import {
  PublishReleaseForm,
  ReferenceStudioReleaseForm,
} from "@/features/reference-studio-updates/release-form";
import {
  type ReferenceStudioPackageKind,
} from "@/features/reference-studio-updates/release-contract";
import { listReferenceStudioReleases } from "@/features/reference-studio-updates/release-store";
import { hasCapability } from "@/lib/authz/permissions";
import type { Actor } from "@/lib/authz/types";

const PACKAGE_KIND_LABELS: Record<ReferenceStudioPackageKind, string> = {
  FULL_SHARE: "完整分享包",
  LOGIC_ONLY: "只更新逻辑",
  TEMPLATE_DATA: "只更新模板/图库",
  RULES_ONLY: "只更新规则源",
};

export default async function ReferenceStudioUpdatesPage() {
  const user = await requireCurrentUser();
  if (!hasCapability(user.role, "REFERENCE_STUDIO_UPDATE_MANAGE")) notFound();

  const actor: Actor = {
    id: user.id,
    role: user.role,
    departmentId: user.department?.id ?? null,
    operationsTeam: user.operationsTeam,
  };
  const releases = await listReferenceStudioReleases(actor);

  return (
    <div className="module-page space-y-6">
      <header className="module-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-base-content/60">Reference Studio 更新中心</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            本地生图程序一键更新
          </h1>
          <p className="mt-3 max-w-3xl leading-7 text-base-content/70">
            商业雷达只保存更新包地址、校验值和版本说明；大文件继续放在网盘或对象存储。
            本地程序检测到已发布版本后，会下载、校验并安装。
          </p>
        </div>
        <div className="card card-border bg-base-100">
          <div className="card-body p-4 text-sm">
            <p className="font-semibold">Latest 接口</p>
            <code className="mt-2 block break-all rounded-box bg-base-200 p-2 text-xs">
              /api/reference-studio/releases/latest?channel=stable
            </code>
          </div>
        </div>
      </header>

      <section className="card card-border bg-base-100" aria-labelledby="release-create-title">
        <div className="card-body">
          <div className="mb-2">
            <h2 className="card-title" id="release-create-title">
              创建更新版本
            </h2>
            <p className="mt-1 text-sm text-base-content/60">
              当前先支持登记外部下载链接；这能绕开 1GB 以上安装包无法直接塞进平台的问题。
            </p>
          </div>
          <ReferenceStudioReleaseForm />
        </div>
      </section>

      <section className="card card-border bg-base-100" aria-labelledby="release-list-title">
        <div className="card-body">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="card-title" id="release-list-title">
                更新版本记录
              </h2>
              <p className="mt-1 text-sm text-base-content/60">
                共 {releases.length} 个版本；只有已发布版本会被本地程序检测到。
              </p>
            </div>
          </div>

          {releases.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>版本</th>
                    <th>范围</th>
                    <th>包信息</th>
                    <th>状态</th>
                    <th>创建</th>
                    <th className="text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {releases.map((release) => (
                    <tr key={release.id}>
                      <td className="min-w-64">
                        <div className="font-semibold">{release.title}</div>
                        <div className="mt-1 font-mono text-xs text-base-content/60">
                          {release.channel} / {release.version}
                        </div>
                        {release.notes ? (
                          <p className="mt-2 line-clamp-2 text-sm text-base-content/65">
                            {release.notes}
                          </p>
                        ) : null}
                      </td>
                      <td>
                        <div className="flex max-w-56 flex-wrap gap-1">
                          {release.templateIds.length ? (
                            release.templateIds.map((templateId) => (
                              <span className="badge badge-sm" key={templateId}>
                                {templateId}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-base-content/55">未标注模板</span>
                          )}
                        </div>
                      </td>
                      <td className="min-w-64">
                        <span className="badge badge-sm badge-outline">
                          {PACKAGE_KIND_LABELS[release.packageKind]}
                        </span>
                        <div className="mt-2 break-all text-xs text-base-content/60">
                          {release.packageUrl}
                        </div>
                        <div className="mt-1 text-xs text-base-content/55">
                          {formatBytes(release.sizeBytes)} · SHA256 {release.sha256.slice(0, 10)}...
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge badge-sm ${
                            release.isPublished
                              ? "badge-success badge-soft"
                              : "badge-ghost"
                          }`}
                        >
                          {release.isPublished ? "已发布" : "草稿"}
                        </span>
                        {release.publishedAt ? (
                          <p className="mt-2 text-xs text-base-content/55">
                            {formatDate(release.publishedAt)}
                          </p>
                        ) : null}
                      </td>
                      <td className="text-sm text-base-content/65">
                        <p>{release.createdByName ?? "未知账号"}</p>
                        <p className="mt-1 text-xs">{formatDate(release.createdAt)}</p>
                      </td>
                      <td className="text-right">
                        <PublishReleaseForm
                          isPublished={release.isPublished}
                          releaseId={release.id}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-box border border-dashed border-base-300 p-10 text-center">
              <h3 className="font-semibold">还没有更新版本</h3>
              <p className="mt-2 text-sm text-base-content/60">
                先把本地分享包上传到外部存储，再在这里登记 URL 和 SHA256。
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function formatBytes(value: bigint | null) {
  if (value === null) return "未填写大小";
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return `${value.toString()} B`;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(date);
}
