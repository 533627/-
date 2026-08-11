import { describe, expect, it, vi } from "vitest";

import {
  BootstrapAdminCliError,
  parseBootstrapAdminArguments,
  runBootstrapAdminCli,
} from "@/features/accounts/bootstrap-admin-cli";
import type { BootstrapAdminStore } from "@/features/accounts/bootstrap-admin";

describe("parseBootstrapAdminArguments", () => {
  it("accepts the required username and display name options", () => {
    expect(
      parseBootstrapAdminArguments([
        "--username",
        "boss.admin",
        "--name",
        "公司老板",
      ]),
    ).toEqual({ username: "boss.admin", name: "公司老板" });
  });

  it("accepts pnpm's leading option terminator", () => {
    expect(
      parseBootstrapAdminArguments([
        "--",
        "--username",
        "boss.admin",
        "--name",
        "公司老板",
      ]),
    ).toEqual({ username: "boss.admin", name: "公司老板" });
  });

  it("rejects missing and unknown options", () => {
    expect(() =>
      parseBootstrapAdminArguments(["--username", "boss.admin"]),
    ).toThrow(BootstrapAdminCliError);
    expect(() =>
      parseBootstrapAdminArguments([
        "--username",
        "boss.admin",
        "--name",
        "公司老板",
        "--password",
        "do-not-accept-passwords",
      ]),
    ).toThrow(BootstrapAdminCliError);
  });
});

describe("runBootstrapAdminCli", () => {
  const store: BootstrapAdminStore = {
    createFirstSuperAdmin: vi.fn(),
  };

  it("writes the one-time password exactly once after successful creation", async () => {
    const writeOutput = vi.fn();
    const password = "OneTimeCliPassword_2026";

    await runBootstrapAdminCli({
      args: ["--username", "boss", "--name", "老板"],
      store,
      writeOutput,
      bootstrap: async () => ({ username: "boss", password }),
    });

    expect(writeOutput).toHaveBeenCalledTimes(1);
    const output = writeOutput.mock.calls[0][0] as string;
    expect(output.match(new RegExp(password, "g"))).toHaveLength(1);
    expect(output).toContain("账号：boss");
    expect(output).toContain("关闭终端后无法再次查看");
  });

  it("does not write credentials when creation fails", async () => {
    const writeOutput = vi.fn();

    await expect(
      runBootstrapAdminCli({
        args: ["--username", "boss", "--name", "老板"],
        store,
        writeOutput,
        bootstrap: async () => {
          throw new Error("database unavailable");
        },
      }),
    ).rejects.toThrow("database unavailable");
    expect(writeOutput).not.toHaveBeenCalled();
  });
});
