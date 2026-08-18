import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

import { config as loadDotenv } from "dotenv";

import { prepareProductionMigrationRepair } from "./repair-production-migrations.mjs";

if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  loadDotenv({ path: ".env.local", override: false });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: options.shell ?? false,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runPackageExecutable(args) {
  const packageManagerScript = process.env.npm_execpath;

  if (packageManagerScript && existsSync(packageManagerScript)) {
    run(process.execPath, [packageManagerScript, "exec", ...args]);
    return;
  }

  const packageRunner = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  run(packageRunner, ["exec", ...args], {
    shell: process.platform === "win32",
  });
}

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl || databaseUrl === "[SENSITIVE]") {
  if (process.env.VERCEL) {
    console.error("DATABASE_URL is required for Vercel production builds.");
    process.exit(1);
  }

  console.warn("DATABASE_URL is not set. Skipping Prisma migrations for local build.");
} else {
  const resolvedMigrations = await prepareProductionMigrationRepair({
    databaseUrl,
  });

  for (const migrationName of resolvedMigrations) {
    runPackageExecutable(["prisma", "migrate", "resolve", "--applied", migrationName]);
  }

  runPackageExecutable(["prisma", "migrate", "deploy"]);
}

runPackageExecutable(["next", "build"]);
