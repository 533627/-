import { getCurrentUser } from "@/features/auth/current-user-server";
import { z } from "zod";
import { BusinessModelImageError } from "@/features/business-models/business-model-image-management";
import { createPrismaBusinessModelImageStore } from "@/features/business-models/business-model-image-store";
import type { Actor } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("未登录", { status: 401 });
  const imageId = z.uuid().safeParse((await params).id);
  if (!imageId.success) return new Response("图片不存在", { status: 404 });
  const actor: Actor = { id: user.id, role: user.role, departmentId: user.department?.id ?? null };
  try {
    const image = await createPrismaBusinessModelImageStore(getDatabase()).getForViewer(actor, imageId.data);
    return new Response(image.data, {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(image.fileName)}`,
        "Content-Length": String(image.size),
        "Content-Type": image.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof BusinessModelImageError) {
      return new Response("图片不存在或无权访问", { status: error.code === "BUSINESS_MODEL_IMAGE_FORBIDDEN" ? 403 : 404 });
    }
    return new Response("图片读取失败", { status: 500 });
  }
}
