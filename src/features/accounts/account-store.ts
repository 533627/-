import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  assertAccountStatusChange,
  assertCanManageAccount,
  shouldRevokeSessionsAfterReset,
} from "@/features/accounts/account-management";
import { hasCapability } from "@/lib/authz/permissions";
import type { Actor, OperationsTeam, Role } from "@/lib/authz/types";

export type AccountCreationCommand = {
  name: string;
  username: string;
  email: string;
  role: Role;
  departmentId: string | null;
  operationsTeam: OperationsTeam | null;
  passwordHash: string;
};

export class AccountStoreError extends Error {
  constructor(
    public readonly code:
      | "USERNAME_ALREADY_EXISTS"
      | "DEPARTMENT_UNAVAILABLE"
      | "OPERATIONS_TEAM_INVALID"
      | "ACCOUNT_NOT_FOUND",
  ) {
    super(code);
    this.name = "AccountStoreError";
  }
}

export function createPrismaAccountStore(database: PrismaClient) {
  return {
    async create(input: AccountCreationCommand) {
      try {
        return await database.$transaction(async (transaction) => {
          if (input.departmentId) {
            const department = await transaction.department.findFirst({
              where: { id: input.departmentId, isActive: true },
              select: { id: true, code: true },
            });
            if (!department) {
              throw new AccountStoreError("DEPARTMENT_UNAVAILABLE");
            }
            if (
              (department.code === "OPERATIONS") !== Boolean(input.operationsTeam)
            ) {
              throw new AccountStoreError("OPERATIONS_TEAM_INVALID");
            }
          } else if (input.operationsTeam) {
            throw new AccountStoreError("OPERATIONS_TEAM_INVALID");
          }

          const userId = randomUUID();
          return transaction.user.create({
            data: {
              id: userId,
              name: input.name,
              email: input.email,
              emailVerified: true,
              username: input.username,
              displayUsername: input.username,
              role: input.role,
              departmentId: input.departmentId,
              operationsTeam: input.operationsTeam,
              accounts: {
                create: {
                  id: randomUUID(),
                  accountId: userId,
                  providerId: "credential",
                  password: input.passwordHash,
                },
              },
            },
            select: { id: true, username: true, name: true },
          });
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new AccountStoreError("USERNAME_ALREADY_EXISTS");
        }
        throw error;
      }
    },

    async list(
      actor: Actor,
      input: { page: number; pageSize: number; query: string },
    ) {
      if (!hasCapability(actor.role, "ACCOUNT_MANAGE")) {
        throw new AccountStoreError("ACCOUNT_NOT_FOUND");
      }

      const pageSize = Math.min(Math.max(input.pageSize, 1), 50);
      const page = Math.max(input.page, 1);
      const query = input.query.trim().slice(0, 50);
      const where: Prisma.UserWhereInput = {
        ...(actor.role === "OPERATIONS_ADMIN"
          ? { role: { not: "SUPER_ADMIN" } }
          : {}),
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { username: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [totalItems, items] = await database.$transaction([
        database.user.count({ where }),
        database.user.findMany({
          where,
          orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
            isActive: true,
            operationsTeam: true,
            department: { select: { id: true, name: true } },
            createdAt: true,
          },
        }),
      ]);

      return {
        items,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        },
      };
    },

    async setActive(actor: Actor, targetId: string, nextIsActive: boolean) {
      return database.$transaction(async (transaction) => {
        const target = await transaction.user.findUnique({
          where: { id: targetId },
          select: { id: true, role: true, isActive: true },
        });
        if (!target) throw new AccountStoreError("ACCOUNT_NOT_FOUND");

        assertAccountStatusChange(actor, target, nextIsActive);
        const updated = await transaction.user.update({
          where: { id: target.id },
          data: { isActive: nextIsActive },
          select: { id: true, username: true, isActive: true },
        });
        if (!nextIsActive) {
          await transaction.session.deleteMany({ where: { userId: target.id } });
        }
        return updated;
      });
    },

    async resetPassword(actor: Actor, targetId: string, passwordHash: string) {
      return database.$transaction(async (transaction) => {
        const target = await transaction.user.findUnique({
          where: { id: targetId },
          select: { id: true, username: true, role: true, isActive: true },
        });
        if (!target) throw new AccountStoreError("ACCOUNT_NOT_FOUND");

        assertCanManageAccount(actor, target);
        const credential = await transaction.account.findFirst({
          where: { userId: target.id, providerId: "credential" },
          select: { id: true },
        });
        if (credential) {
          await transaction.account.update({
            where: { id: credential.id },
            data: { password: passwordHash },
          });
        } else {
          await transaction.account.create({
            data: {
              id: randomUUID(),
              accountId: target.id,
              providerId: "credential",
              userId: target.id,
              password: passwordHash,
            },
          });
        }
        if (shouldRevokeSessionsAfterReset(actor, target.id)) {
          await transaction.session.deleteMany({ where: { userId: target.id } });
        }
        return { id: target.id, username: target.username };
      });
    },

    async updateUsername(
      actor: Actor,
      targetId: string,
      input: { username: string; email: string },
    ) {
      try {
        return await database.$transaction(async (transaction) => {
          const target = await transaction.user.findUnique({
            where: { id: targetId },
            select: { id: true, role: true, isActive: true },
          });
          if (!target) throw new AccountStoreError("ACCOUNT_NOT_FOUND");
          assertCanManageAccount(actor, target);
          return transaction.user.update({
            where: { id: target.id },
            data: {
              username: input.username,
              displayUsername: input.username,
              email: input.email,
            },
            select: { id: true, username: true },
          });
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new AccountStoreError("USERNAME_ALREADY_EXISTS");
        }
        throw error;
      }
    },
  };
}
