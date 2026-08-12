import { z } from "zod";

const messageSchema = z.string().trim().min(1).max(2000);

export function prepareConversationMessage(input: unknown) {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) throw new Error("INVALID_CONVERSATION_MESSAGE");
  return parsed.data;
}
