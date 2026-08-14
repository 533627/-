"use client";

import Image from "next/image";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  deleteBusinessModelImageAction,
  uploadBusinessModelImageAction,
  type BusinessModelImageActionState,
} from "@/features/business-models/business-model-image-actions";
import { ImagePreparationError, prepareImageFile } from "@/features/business-models/business-model-image-compression";

const initialState: BusinessModelImageActionState = { status: "idle" };

type ImageItem = {
  id: string;
  fileName: string;
  size: number;
  createdAt: string;
  uploadedBy: { name: string };
};

export function BusinessModelImagePanel({
  businessModelId,
  canManage,
  images,
}: {
  businessModelId: string;
  canManage: boolean;
  images: ImageItem[];
}) {
  const [state, action, isUploading] = useActionState(uploadBusinessModelImageAction, initialState);
  const [isPreparing, setIsPreparing] = useState(false);
  const [clientError, setClientError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <section aria-labelledby="business-model-images-title" className="card card-border bg-base-100">
      <div className="card-body gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="card-title text-lg" id="business-model-images-title">参考图片</h2>
            <p className="mt-1 text-sm text-base-content/60">保存店铺截图、商品图和视觉案例，团队成员都能在这里查看。</p>
          </div>
          <span className="text-xs text-base-content/50">{images.length} / 50 张</span>
        </div>

        {images.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image) => (
              <li className="group overflow-hidden border border-base-300 bg-base-200/40" key={image.id}>
                <a className="relative block aspect-[4/3] overflow-hidden bg-[#12120f]/5" href={`/api/business-model-images/${image.id}`} target="_blank">
                  <Image
                    alt={image.fileName}
                    className="object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    src={`/api/business-model-images/${image.id}`}
                    unoptimized
                  />
                </a>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold" title={image.fileName}>{image.fileName}</p>
                  <p className="mt-1 text-xs text-base-content/50">{formatBytes(image.size)} · {image.uploadedBy.name} · {formatDate(image.createdAt)}</p>
                  {canManage ? <ImageDeleteForm imageId={image.id} /> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="border border-dashed border-base-300 bg-base-200/30 px-5 py-10 text-center" role="status">
            <p className="font-medium">还没有参考图片</p>
            <p className="mt-1 text-sm text-base-content/55">上传第一张商品图或店铺截图，帮助团队快速理解这个模式。</p>
          </div>
        )}

        {canManage ? (
          <form
            className="border-t border-base-300 pt-4"
            encType="multipart/form-data"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const input = form.elements.namedItem("image");
              if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
              setClientError("");
              setIsPreparing(true);
              try {
                const preparedFile = await prepareImageFile(input.files[0]);
                const formData = new FormData(form);
                formData.set("image", preparedFile);
                startTransition(() => action(formData));
              } catch (error) {
                setClientError(error instanceof ImagePreparationError ? error.userMessage : "图片处理失败，请重试。");
              } finally {
                setIsPreparing(false);
              }
            }}
            ref={formRef}
          >
            <input name="businessModelId" type="hidden" value={businessModelId} />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="fieldset min-w-0 grow" htmlFor="business-model-image">
                <span className="fieldset-legend">上传图片</span>
                <input
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="file-input w-full"
                  id="business-model-image"
                  name="image"
                  required
                  type="file"
                />
                <span className="label">JPG、PNG、WebP 原图可到 8MB并自动压缩；GIF 为保留动画限 3MB。</span>
              </label>
              <UploadButton pending={isPreparing || isUploading} preparing={isPreparing} />
            </div>
            {clientError || state.status !== "idle" ? (
              <div className={`alert alert-soft mt-3 ${clientError || state.status === "error" ? "alert-error" : "alert-success"}`} role={clientError || state.status === "error" ? "alert" : "status"}>{clientError || (state.status !== "idle" ? state.message : "")}</div>
            ) : null}
          </form>
        ) : null}
      </div>
    </section>
  );
}

function ImageDeleteForm({ imageId }: { imageId: string }) {
  const [state, action] = useActionState(deleteBusinessModelImageAction, initialState);
  return (
    <form
      action={action}
      className="mt-3"
      onSubmit={(event) => { if (!window.confirm("确定删除这张图片吗？")) event.preventDefault(); }}
    >
      <input name="imageId" type="hidden" value={imageId} />
      <DeleteButton />
      {state.status === "error" ? <p className="mt-2 text-xs text-error" role="alert">{state.message}</p> : null}
    </form>
  );
}

function UploadButton({ pending, preparing }: { pending: boolean; preparing: boolean }) {
  return <button className="btn btn-primary sm:mb-[1.55rem]" disabled={pending} type="submit">{preparing ? "正在压缩…" : pending ? "上传中…" : "上传图片"}</button>;
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return <button className="btn btn-ghost btn-xs text-error" disabled={pending} type="submit">{pending ? "删除中…" : "删除图片"}</button>;
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(new Date(value));
}
