"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createBusinessModelAction,
  updateBusinessModelAction,
  type BusinessModelActionState,
} from "@/features/business-models/actions";
import {
  ImagePreparationError,
  prepareImageFile,
  validateImageSource,
} from "@/features/business-models/business-model-image-compression";
import { uploadBusinessModelImageAction } from "@/features/business-models/business-model-image-actions";

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
          <div><h2 className="text-xl font-semibold">记录商业模式</h2><p className="mt-2 text-sm text-base-content/65">填写内容时可同时选择商品图、店铺截图和视觉案例，点击保存后会一起上传。</p></div>
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
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imageSelectionError, setImageSelectionError] = useState("");
  const [imageUploadState, setImageUploadState] = useState<{ status: "idle" | "uploading" | "success" | "error"; message: string }>({ status: "idle", message: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImagesRef = useRef<File[] | null>(null);
  const uploadStartedForRecordRef = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== "create" || state.status !== "success" || !state.recordId) return;
    const pendingImages = pendingImagesRef.current;
    if (!pendingImages?.length || uploadStartedForRecordRef.current === state.recordId) return;
    const images = [...pendingImages];
    const recordId = state.recordId;

    uploadStartedForRecordRef.current = recordId;
    pendingImagesRef.current = null;
    let cancelled = false;

    async function uploadSelectedImages() {
      for (const [index, sourceFile] of images.entries()) {
        if (cancelled) return;
        setImageUploadState({
          status: "uploading",
          message: `正在处理第 ${index + 1}/${images.length} 张图片…`,
        });
        try {
          const image = await prepareImageFile(sourceFile);
          const formData = new FormData();
          formData.set("businessModelId", recordId);
          formData.set("image", image);
          const result = await uploadBusinessModelImageAction({ status: "idle" }, formData);
          if (result.status === "error") throw new Error(result.message);
        } catch (error) {
          if (!cancelled) {
            setImageUploadState({
              status: "error",
              message: `商业模式已保存，但第 ${index + 1} 张图片上传失败：${imageErrorMessage(error)}`,
            });
          }
          return;
        }
      }
      if (!cancelled) {
        setSelectedImages([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setImageUploadState({ status: "success", message: `商业模式与 ${images.length} 张图片均已保存。` });
      }
    }

    void uploadSelectedImages();
    return () => { cancelled = true; };
  }, [mode, state]);

  function selectImages(files: FileList | null) {
    if (!files?.length) return;
    setImageSelectionError("");
    setImageUploadState({ status: "idle", message: "" });
    const existingKeys = new Set(selectedImages.map(fileKey));
    const accepted: File[] = [];
    let firstError = "";
    for (const file of Array.from(files)) {
      if (existingKeys.has(fileKey(file))) continue;
      try {
        validateImageSource(file);
        existingKeys.add(fileKey(file));
        accepted.push(file);
      } catch (error) {
        firstError ||= imageErrorMessage(error);
      }
    }
    const remaining = Math.max(0, 50 - selectedImages.length);
    if (accepted.length > remaining) firstError ||= "每条商业整理最多保存 50 张图片。";
    setSelectedImages((current) => [...current, ...accepted.slice(0, remaining)]);
    setImageSelectionError(firstError);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return <form action={action} className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={() => {
    if (mode !== "create") return;
    pendingImagesRef.current = [...selectedImages];
    uploadStartedForRecordRef.current = null;
    setImageUploadState({ status: "idle", message: "" });
  }}>
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
    {mode === "create" ? <ImagePicker
      error={imageSelectionError}
      files={selectedImages}
      inputRef={fileInputRef}
      onRemove={(key) => setSelectedImages((current) => current.filter((file) => fileKey(file) !== key))}
      onSelect={selectImages}
    /> : null}
    {state.status !== "idle" ? <div className={`alert alert-soft sm:col-span-2 ${state.status === "error" ? "alert-error" : "alert-success"}`} role={state.status === "error" ? "alert" : "status"}>{state.message}{state.status === "success" && state.recordId ? <a className="btn btn-sm ml-auto" href={`/business-models/${state.recordId}#reference-images`}>查看详情</a> : null}</div> : null}
    {imageUploadState.status !== "idle" ? <div className={`alert alert-soft sm:col-span-2 ${imageUploadState.status === "error" ? "alert-error" : imageUploadState.status === "success" ? "alert-success" : "alert-info"}`} role={imageUploadState.status === "error" ? "alert" : "status"}>{imageUploadState.message}</div> : null}
    <div className="flex justify-end sm:col-span-2"><SubmitButton label={mode === "create" ? selectedImages.length ? `保存商业模式与 ${selectedImages.length} 张图片` : "保存商业模式" : "保存新版本"} /></div>
  </form>;
}

function ImagePicker({ error, files, inputRef, onRemove, onSelect }: {
  error: string;
  files: File[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  onRemove: (key: string) => void;
  onSelect: (files: FileList | null) => void;
}) {
  return <fieldset className="fieldset rounded-box border border-base-300 bg-base-200/45 p-4 sm:col-span-2">
    <legend className="fieldset-legend px-2">参考图片（选填）</legend>
    <p className="text-sm text-base-content/65">记录时直接选择，点击保存后自动压缩并逐张上传。支持 JPG、PNG、WebP、GIF，最多 50 张。</p>
    <label className="sr-only" htmlFor="business-model-images">选择参考图片</label>
    <input
      accept="image/jpeg,image/png,image/webp,image/gif"
      className="file-input mt-3 w-full"
      id="business-model-images"
      multiple
      onChange={(event) => onSelect(event.currentTarget.files)}
      ref={inputRef}
      type="file"
    />
    {files.length ? <div className="mt-3 grid gap-2">
      <div className="text-xs font-medium text-base-content/55">已选择 {files.length} 张</div>
      {files.map((file) => <div className="flex items-center gap-3 rounded-lg border border-base-300 bg-base-100 px-3 py-2" key={fileKey(file)}>
        <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
        <span className="shrink-0 text-xs text-base-content/50">{formatFileSize(file.size)}</span>
        <button aria-label={`移除 ${file.name}`} className="btn btn-ghost btn-xs" onClick={() => onRemove(fileKey(file))} type="button">移除</button>
      </div>)}
    </div> : null}
    {error ? <p className="mt-2 text-sm text-error" role="alert">{error}</p> : null}
  </fieldset>;
}

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function imageErrorMessage(error: unknown) {
  if (error instanceof ImagePreparationError) return error.userMessage;
  return error instanceof Error ? error.message : "图片处理失败，请重新选择。";
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
