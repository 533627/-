import type { PrismaClient } from "@/generated/prisma/client";
import {
  assertCanManageBusinessModelImages,
  BUSINESS_MODEL_IMAGE_MAX_COUNT,
  BusinessModelImageError,
} from "@/features/business-models/business-model-image-management";
import { hasCapability } from "@/lib/authz/permissions";
import type { Actor } from "@/lib/authz/types";

type PreparedImage = {
  fileName: string;
  mimeType: string;
  size: number;
  data: Uint8Array;
};

export function createPrismaBusinessModelImageStore(database: PrismaClient) {
  return {
    async add(actor: Actor, businessModelId: string, image: PreparedImage) {
      assertCanManageBusinessModelImages(actor);
      return database.$transaction(async (transaction) => {
        const businessModel = await transaction.businessModel.findFirst({
          where: { id: businessModelId, status: { not: "DELETED" } },
          select: { id: true },
        });
        if (!businessModel) throw new BusinessModelImageError("BUSINESS_MODEL_IMAGE_NOT_FOUND");
        const imageCount = await transaction.businessModelImage.count({ where: { businessModelId } });
        if (imageCount >= BUSINESS_MODEL_IMAGE_MAX_COUNT) {
          throw new BusinessModelImageError("BUSINESS_MODEL_IMAGE_LIMIT_REACHED");
        }
        return transaction.businessModelImage.create({
          data: {
            ...image,
            data: Uint8Array.from(image.data),
            businessModelId,
            uploadedById: actor.id,
          },
          select: { id: true, businessModelId: true },
        });
      });
    },

    async remove(actor: Actor, imageId: string) {
      assertCanManageBusinessModelImages(actor);
      const image = await database.businessModelImage.findFirst({
        where: { id: imageId, businessModel: { status: { not: "DELETED" } } },
        select: { id: true, businessModelId: true },
      });
      if (!image) throw new BusinessModelImageError("BUSINESS_MODEL_IMAGE_NOT_FOUND");
      await database.businessModelImage.delete({ where: { id: image.id } });
      return image;
    },

    async getForViewer(actor: Actor, imageId: string) {
      if (!hasCapability(actor.role, "BUSINESS_MODEL_VIEW")) {
        throw new BusinessModelImageError("BUSINESS_MODEL_IMAGE_FORBIDDEN");
      }
      const image = await database.businessModelImage.findFirst({
        where: {
          id: imageId,
          ...(actor.role === "SUPER_ADMIN" ? {} : { businessModel: { status: { not: "DELETED" } } }),
        },
        select: { data: true, fileName: true, mimeType: true, size: true },
      });
      if (!image) throw new BusinessModelImageError("BUSINESS_MODEL_IMAGE_NOT_FOUND");
      return image;
    },
  };
}
