"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import { createPrismaConversationStore, ConversationStoreError } from "@/features/conversations/conversation-store";
import { OPERATIONS_TEAMS, type Actor } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";

export type ConversationActionState = { status: "idle" | "success" | "error"; message?: string };
const targetSchema = z.object({
  kind: z.enum(["department", "project"]),
  conversationId: z.uuid(),
  operationsTeam: z.enum(OPERATIONS_TEAMS).nullable(),
});

export async function sendConversationMessageAction(
  _state: ConversationActionState,
  formData: FormData,
): Promise<ConversationActionState> {
  const user = await requireCurrentUser();
  const actor: Actor = { id: user.id, role: user.role, departmentId: user.department?.id ?? null, operationsTeam: user.operationsTeam };
  const target = targetSchema.safeParse({ kind: formData.get("kind"), conversationId: formData.get("conversationId"), operationsTeam: optionalString(formData.get("operationsTeam")) });
  if (!target.success) return { status: "error", message: "群聊标识无效。" };
  try {
    const store = createPrismaConversationStore(getDatabase());
    if (target.data.kind === "department") {
      await store.sendDepartment(actor, target.data.conversationId, formData.get("content"), target.data.operationsTeam);
    } else {
      await store.sendProject(actor, target.data.conversationId, formData.get("content"));
    }
    revalidatePath("/conversations");
    return { status: "success", message: "消息已发送。" };
  } catch (error) {
    if (error instanceof ConversationStoreError) return { status: "error", message: "你无权进入这个群聊。" };
    if (error instanceof Error && error.message === "INVALID_CONVERSATION_MESSAGE") return { status: "error", message: "请输入 1 至 2000 个字。" };
    return { status: "error", message: "发送失败，请稍后重试。" };
  }
}

function optionalString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value ? value : null;
}
