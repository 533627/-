"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  type ReferenceStudioReleaseActionState,
  createReferenceStudioReleaseAction,
  setReferenceStudioReleasePublishedAction,
} from "@/features/reference-studio-updates/actions";
import {
  REFERENCE_STUDIO_PACKAGE_KINDS,
  type ReferenceStudioPackageKind,
} from "@/features/reference-studio-updates/release-contract";

const INITIAL_STATE: ReferenceStudioReleaseActionState = { status: "idle" };

const PACKAGE_KIND_LABELS: Record<ReferenceStudioPackageKind, string> = {
  FULL_SHARE: "完整分享包",
  LOGIC_ONLY: "只更新逻辑",
  TEMPLATE_DATA: "只更新模板/图库",
  RULES_ONLY: "只更新规则源",
};

export function ReferenceStudioReleaseForm() {
  const [state, formAction] = useActionState(
    createReferenceStudioReleaseAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-2">
      <fieldset className="fieldset">
        <legend className="fieldset-legend">版本号</legend>
        <input
          className="input w-full"
          maxLength={80}
          name="version"
          placeholder="2026.08.17-shanxi-xinxu-mkhf"
          required
        />
        <p className="label">同一通道下版本号不能重复。</p>
      </fieldset>

      <fieldset className="fieldset">
        <legend className="fieldset-legend">更新通道</legend>
        <input
          className="input w-full"
          defaultValue="stable"
          maxLength={50}
          name="channel"
          required
        />
        <p className="label">默认 stable；以后可以加 test/internal。</p>
      </fieldset>

      <fieldset className="fieldset">
        <legend className="fieldset-legend">标题</legend>
        <input
          className="input w-full"
          maxLength={200}
          name="title"
          placeholder="山系 / 新序 / 马克华菲逻辑与数据更新"
          required
        />
      </fieldset>

      <fieldset className="fieldset">
        <legend className="fieldset-legend">包类型</legend>
        <select className="select w-full" name="packageKind" required>
          {REFERENCE_STUDIO_PACKAGE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {PACKAGE_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset className="fieldset lg:col-span-2">
        <legend className="fieldset-legend">更新包下载 URL</legend>
        <input
          className="input w-full"
          name="packageUrl"
          placeholder="https://..."
          required
          type="url"
        />
        <p className="label">大包放网盘/对象存储，这里只登记下载地址。</p>
      </fieldset>

      <fieldset className="fieldset">
        <legend className="fieldset-legend">SHA256</legend>
        <input
          className="input w-full font-mono text-xs"
          maxLength={64}
          minLength={64}
          name="sha256"
          placeholder="64 位十六进制校验值"
          required
        />
      </fieldset>

      <fieldset className="fieldset">
        <legend className="fieldset-legend">文件大小（字节，可选）</legend>
        <input
          className="input w-full"
          inputMode="numeric"
          name="sizeBytes"
          placeholder="例如 1320000000"
        />
      </fieldset>

      <fieldset className="fieldset lg:col-span-2">
        <legend className="fieldset-legend">包含模板 ID（可选）</legend>
        <textarea
          className="textarea min-h-24 w-full font-mono text-sm"
          name="templateIds"
          placeholder="shan_xi, xin_xu, ma_ke_hua_fei"
        />
        <p className="label">用逗号、空格或换行分隔；本地程序会据此提示更新范围。</p>
      </fieldset>

      <fieldset className="fieldset lg:col-span-2">
        <legend className="fieldset-legend">版本说明</legend>
        <textarea
          className="textarea min-h-28 w-full"
          name="notes"
          placeholder="写清这次更新了哪些模板、数据库、提示词路由或修复点。"
        />
      </fieldset>

      <label className="flex items-center gap-3 rounded-box border border-base-300 p-3 lg:col-span-2">
        <input className="checkbox" name="publishNow" type="checkbox" />
        <span>
          创建后立即发布
          <span className="block text-sm text-base-content/60">
            不勾选时只保存草稿，本地程序不会检测到。
          </span>
        </span>
      </label>

      {state.status !== "idle" ? (
        <div
          className={`alert lg:col-span-2 ${
            state.status === "success" ? "alert-success" : "alert-error"
          }`}
          role="alert"
        >
          <span>{state.message}</span>
        </div>
      ) : null}

      <div className="flex justify-end lg:col-span-2">
        <SubmitButton />
      </div>
    </form>
  );
}

export function PublishReleaseForm({
  releaseId,
  isPublished,
}: {
  releaseId: string;
  isPublished: boolean;
}) {
  const [state, formAction] = useActionState(
    setReferenceStudioReleasePublishedAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <input name="releaseId" type="hidden" value={releaseId} />
      <input
        name="nextIsPublished"
        type="hidden"
        value={isPublished ? "false" : "true"}
      />
      <button className="btn btn-sm" type="submit">
        {isPublished ? "取消发布" : "发布"}
      </button>
      {state.status === "error" ? (
        <p className="max-w-40 text-right text-xs text-error">{state.message}</p>
      ) : null}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" disabled={pending} type="submit">
      {pending ? "保存中..." : "创建更新版本"}
    </button>
  );
}
