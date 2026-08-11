import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

import { PrismaClient } from "@/generated/prisma/client";

const databaseEnvironmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .refine(
      (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
      "DATABASE_URL must be a PostgreSQL connection string.",
    ),
});

const globalForDatabase = globalThis as typeof globalThis & {
  companyOpsDatabase?: PrismaClient;
};

export function getDatabase() {
  if (globalForDatabase.companyOpsDatabase) {
    return globalForDatabase.companyOpsDatabase;
  }

  const { DATABASE_URL } = databaseEnvironmentSchema.parse(process.env);
  const database = new PrismaClient({
    adapter: new PrismaPg({ connectionString: DATABASE_URL }),
  });

  if (process.env.NODE_ENV !== "production") {
    globalForDatabase.companyOpsDatabase = database;
  }

  return database;
}

export async function withTimeout<T>(operation: Promise<T>, timeoutMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("Database health check timed out.")),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function checkDatabaseConnection() {
  const database = getDatabase();

  await withTimeout(database.$queryRaw`SELECT 1`, 2_000);
}
