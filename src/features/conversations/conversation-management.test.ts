import { describe, expect, it } from "vitest";

import { prepareConversationMessage } from "@/features/conversations/conversation-management";

describe("conversation messages", () => {
  it("trims a valid message", () => {
    expect(prepareConversationMessage("  今天完成选品表  ")).toBe("今天完成选品表");
  });

  it("rejects empty and oversized messages", () => {
    expect(() => prepareConversationMessage("   ")).toThrowError("INVALID_CONVERSATION_MESSAGE");
    expect(() => prepareConversationMessage("a".repeat(2001))).toThrowError("INVALID_CONVERSATION_MESSAGE");
  });
});
