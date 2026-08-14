const SOURCE_MAX_BYTES = 8 * 1024 * 1024;
const STORED_MAX_BYTES = 3 * 1024 * 1024;
const MAX_EDGE = 2400;
const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class ImagePreparationError extends Error {
  constructor(public readonly userMessage: string) {
    super(userMessage);
    this.name = "ImagePreparationError";
  }
}

export async function prepareImageFile(file: File) {
  if (file.size > SOURCE_MAX_BYTES) {
    throw new ImagePreparationError("原图不能超过 8MB，请选择较小的图片。");
  }
  if (file.type === "image/gif") {
    if (file.size > STORED_MAX_BYTES) {
      throw new ImagePreparationError("GIF 为保留动画不能自动压缩，请控制在 3MB 以内。");
    }
    return file;
  }
  if (!COMPRESSIBLE_TYPES.has(file.type)) {
    throw new ImagePreparationError("仅支持 JPG、PNG、WebP 和 GIF 图片。");
  }

  const source = await loadImage(file);
  const initialScale = Math.min(1, MAX_EDGE / Math.max(source.naturalWidth, source.naturalHeight));
  let scale = initialScale;
  let bestBlob: Blob | null = null;

  try {
    for (let sizeAttempt = 0; sizeAttempt < 3; sizeAttempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new ImagePreparationError("当前浏览器无法处理图片，请换一张图片重试。");
      context.drawImage(source, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.86, 0.72, 0.58, 0.45]) {
        const blob = await canvasToBlob(canvas, quality);
        if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
        if (blob.size <= STORED_MAX_BYTES) {
          if (file.size <= STORED_MAX_BYTES && file.size <= blob.size && initialScale === 1) return file;
          return toCompressedFile(file, blob);
        }
      }
      scale *= 0.78;
    }
  } finally {
    URL.revokeObjectURL(source.src);
  }

  if (bestBlob && bestBlob.size <= STORED_MAX_BYTES) return toCompressedFile(file, bestBlob);
  throw new ImagePreparationError("图片压缩后仍然过大，请换一张图片重试。");
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(image.src);
      reject(new ImagePreparationError("无法读取这张图片，请确认文件没有损坏。"));
    };
    image.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new ImagePreparationError("图片压缩失败，请换一张图片重试。"));
    }, "image/webp", quality);
  });
}

function toCompressedFile(source: File, blob: Blob) {
  const baseName = source.name.replace(/\.[^.]+$/, "") || "商业整理图片";
  const output = blob.type === "image/webp"
    ? { extension: "webp", type: "image/webp" }
    : blob.type === "image/jpeg"
      ? { extension: "jpg", type: "image/jpeg" }
      : { extension: "png", type: "image/png" };
  return new File([blob], `${baseName}.${output.extension}`, { type: output.type, lastModified: Date.now() });
}
