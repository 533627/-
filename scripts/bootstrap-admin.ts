import "dotenv/config";

import { BootstrapAdminError } from "../src/features/accounts/bootstrap-admin";
import {
  BootstrapAdminCliError,
  runBootstrapAdminCli,
} from "../src/features/accounts/bootstrap-admin-cli";
import { createPrismaBootstrapAdminStore } from "../src/features/accounts/bootstrap-admin-store";
import { getDatabase } from "../src/lib/db";

let database: ReturnType<typeof getDatabase> | undefined;

try {
  database = getDatabase();
  await runBootstrapAdminCli({
    args: process.argv.slice(2),
    store: createPrismaBootstrapAdminStore(database),
    writeOutput: (output) => process.stdout.write(output),
  });
} catch (error) {
  process.exitCode = 1;

  if (error instanceof BootstrapAdminCliError) {
    process.stderr.write(`${error.message}\n`);
  } else if (
    error instanceof BootstrapAdminError &&
    error.code === "SUPER_ADMIN_ALREADY_EXISTS"
  ) {
    process.stderr.write("初始化被拒绝：最高管理员已经存在。\n");
  } else if (
    error instanceof BootstrapAdminError &&
    error.code === "INVALID_BOOTSTRAP_INPUT"
  ) {
    process.stderr.write(
      "初始化参数无效：账号只能包含字母、数字、下划线和点，长度为 3–30。\n",
    );
  } else {
    process.stderr.write("最高管理员初始化失败，请检查数据库配置后重试。\n");
  }
} finally {
  await database?.$disconnect();
}
