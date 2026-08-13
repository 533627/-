ALTER TYPE "NotificationType" ADD VALUE 'DIRECT_MESSAGE';

CREATE TABLE "direct_messages" (
    "id" UUID NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMPTZ(3),
    CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "direct_messages_senderId_recipientId_createdAt_idx" ON "direct_messages"("senderId", "recipientId", "createdAt");
CREATE INDEX "direct_messages_recipientId_readAt_createdAt_idx" ON "direct_messages"("recipientId", "readAt", "createdAt");

ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
