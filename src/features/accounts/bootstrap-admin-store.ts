import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { BootstrapAdminStore } from "@/features/accounts/bootstrap-admin";

const MAX_TRANSACTION_ATTEMPTS = 3;

export function createPrismaBootstrapAdminStore(
  database: PrismaClient,
): BootstrapAdminStore {
  return {
    async createFirstSuperAdmin(input) {
      for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
        try {
          return await database.$transaction(
            async (transaction) => {
              const existingSuperAdmin = await transaction.user.findFirst({
                where: { role: "SUPER_ADMIN" },
                select: { id: true },
              });

              if (existingSuperAdmin) {
                return "already_exists" as const;
              }

              const userId = randomUUID();
              await transaction.user.create({
                data: {
                  id: userId,
                  name: input.name,
                  email: input.email,
                  emailVerified: true,
                  username: input.username,
                  displayUsername: input.username,
                  role: "SUPER_ADMIN",
                  departmentId: null,
                  accounts: {
                    create: {
                      id: randomUUID(),
                      accountId: userId,
                      providerId: "credential",
                      password: input.passwordHash,
                    },
                  },
                },
              });

              return "created" as const;
            },
            {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            },
          );
        } catch (error) {
          const shouldRetry =
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2034" &&
            attempt < MAX_TRANSACTION_ATTEMPTS;

          if (!shouldRetry) {
            throw error;
          }
        }
      }

      throw new Error("Super-administrator bootstrap transaction failed.");
    },
  };
}
