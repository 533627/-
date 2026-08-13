import { describe, expect, it } from "vitest";

import { assertDirectMessageTarget } from "@/features/conversations/direct-message-management";

describe("direct message authorization", () => {
  it("allows messaging another active employee", () => {
    expect(() => assertDirectMessageTarget("sender", { id: "recipient", isActive: true })).not.toThrow();
  });

  it("rejects messaging self or an inactive employee", () => {
    expect(() => assertDirectMessageTarget("sender", { id: "sender", isActive: true })).toThrow("DIRECT_MESSAGE_TARGET_INVALID");
    expect(() => assertDirectMessageTarget("sender", { id: "recipient", isActive: false })).toThrow("DIRECT_MESSAGE_TARGET_INVALID");
  });
});
