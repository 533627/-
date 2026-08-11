import { parseArgs } from "node:util";

import {
  bootstrapSuperAdmin,
  type BootstrapAdminStore,
} from "@/features/accounts/bootstrap-admin";

type BootstrapFunction = (
  store: BootstrapAdminStore,
  input: { username: string; name: string },
) => Promise<{ username: string; password: string }>;

export class BootstrapAdminCliError extends Error {
  readonly code = "INVALID_ARGUMENTS";

  constructor() {
    super(
      'Usage: pnpm bootstrap:admin -- --username <username> --name "<display name>"',
    );
    this.name = "BootstrapAdminCliError";
  }
}

export function parseBootstrapAdminArguments(args: string[]) {
  try {
    const normalizedArgs = args[0] === "--" ? args.slice(1) : args;
    const { values } = parseArgs({
      args: normalizedArgs,
      allowPositionals: false,
      strict: true,
      options: {
        username: { type: "string" },
        name: { type: "string" },
      },
    });

    if (!values.username || !values.name) {
      throw new BootstrapAdminCliError();
    }

    return { username: values.username, name: values.name };
  } catch (error) {
    if (error instanceof BootstrapAdminCliError) {
      throw error;
    }

    throw new BootstrapAdminCliError();
  }
}

export async function runBootstrapAdminCli(options: {
  args: string[];
  store: BootstrapAdminStore;
  writeOutput: (output: string) => void;
  bootstrap?: BootstrapFunction;
}) {
  const input = parseBootstrapAdminArguments(options.args);
  const credentials = await (options.bootstrap ?? bootstrapSuperAdmin)(
    options.store,
    input,
  );

  options.writeOutput(
    [
      "最高管理员创建成功。",
      `账号：${credentials.username}`,
      `临时密码：${credentials.password}`,
      "请立即通过安全渠道保存；关闭终端后无法再次查看。",
      "",
    ].join("\n"),
  );
}
