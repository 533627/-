import { describe, expect, it } from "vitest";

import { appConfig } from "@/lib/app-config";

describe("appConfig", () => {
  it("provides the stable Chinese product identity", () => {
    expect(appConfig.name).toBe("商序终端");
    expect(appConfig.description).toContain("电商项目");
  });
});
