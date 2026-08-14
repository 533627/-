import { describe, expect, it } from "vitest";

import { validateImageSource } from "@/features/business-models/business-model-image-compression";

describe("validateImageSource", () => {
  it("accepts an ordinary image up to eight megabytes", () => {
    expect(() => validateImageSource({ type: "image/jpeg", size: 8 * 1024 * 1024 })).not.toThrow();
  });

  it("rejects an ordinary image larger than eight megabytes", () => {
    expect(() => validateImageSource({ type: "image/png", size: 8 * 1024 * 1024 + 1 }))
      .toThrow("原图不能超过 8MB");
  });

  it("keeps animated GIF source files below three megabytes", () => {
    expect(() => validateImageSource({ type: "image/gif", size: 3 * 1024 * 1024 + 1 }))
      .toThrow("GIF 为保留动画不能自动压缩");
  });
});
