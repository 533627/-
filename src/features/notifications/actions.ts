"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import { createPrismaNotificationStore } from "@/features/notifications/notification-store";
import { getDatabase } from "@/lib/db";

export async function markAllNotificationsReadAction() {
  const user = await requireCurrentUser();
  await createPrismaNotificationStore(getDatabase()).markAllRead(user.id);
  revalidatePath("/notifications");
}
