import type { PrismaClient } from "@/generated/prisma/client";

export function createPrismaNotificationStore(database: PrismaClient) {
  return {
    async list(userId: string) {
      const [items, unreadCount] = await database.$transaction([
        database.notification.findMany({
          where: { recipientId: userId },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        database.notification.count({ where: { recipientId: userId, isRead: false } }),
      ]);
      return { items, unreadCount };
    },

    async unreadCount(userId: string) {
      return database.notification.count({ where: { recipientId: userId, isRead: false } });
    },

    async markAllRead(userId: string) {
      return database.notification.updateMany({
        where: { recipientId: userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
    },
  };
}
