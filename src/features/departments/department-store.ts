import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  assertCanTransferMember,
  DepartmentManagementError,
} from "@/features/departments/department-management";
import { hasCapability } from "@/lib/authz/permissions";
import type { Actor } from "@/lib/authz/types";

export class DepartmentStoreError extends Error {
  constructor(
    public readonly code:
      | "DEPARTMENT_ALREADY_EXISTS"
      | "DEPARTMENT_NOT_FOUND"
      | "DEPARTMENT_HAS_ACTIVE_MEMBERS"
      | "DESTINATION_UNAVAILABLE"
      | "MEMBER_NOT_FOUND",
  ) {
    super(code);
    this.name = "DepartmentStoreError";
  }
}

export function createPrismaDepartmentStore(database: PrismaClient) {
  return {
    async create(actor: Actor, input: { code: string; name: string }) {
      if (!hasCapability(actor.role, "DEPARTMENT_STRUCTURE_MANAGE")) {
        throw new DepartmentManagementError("DEPARTMENT_OPERATION_FORBIDDEN");
      }
      try {
        return await database.department.create({ data: input });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new DepartmentStoreError("DEPARTMENT_ALREADY_EXISTS");
        }
        throw error;
      }
    },

    async list(actor: Actor) {
      if (!hasCapability(actor.role, "DEPARTMENT_MEMBERS_VIEW")) {
        throw new DepartmentManagementError("MEMBER_OPERATION_FORBIDDEN");
      }
      const where =
        actor.role === "DEPARTMENT_MANAGER"
          ? { id: actor.departmentId ?? "00000000-0000-0000-0000-000000000000" }
          : undefined;
      return database.department.findMany({
        where,
        orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
          members: {
            where: { role: { not: "SUPER_ADMIN" } },
            orderBy: [{ role: "asc" }, { name: "asc" }],
            select: {
              id: true,
              name: true,
              username: true,
              role: true,
              isActive: true,
              membershipChanges: {
                orderBy: { changedAt: "desc" },
                take: 1,
                select: { changedAt: true, fromDepartment: { select: { name: true } } },
              },
            },
          },
        },
      });
    },

    async setActive(actor: Actor, departmentId: string, nextIsActive: boolean) {
      if (!hasCapability(actor.role, "DEPARTMENT_STRUCTURE_MANAGE")) {
        throw new DepartmentManagementError("DEPARTMENT_OPERATION_FORBIDDEN");
      }
      return database.$transaction(async (transaction) => {
        const department = await transaction.department.findUnique({
          where: { id: departmentId },
          select: { id: true, isActive: true },
        });
        if (!department) throw new DepartmentStoreError("DEPARTMENT_NOT_FOUND");
        if (!nextIsActive) {
          const activeMembers = await transaction.user.count({
            where: { departmentId, isActive: true },
          });
          if (activeMembers > 0) {
            throw new DepartmentStoreError("DEPARTMENT_HAS_ACTIVE_MEMBERS");
          }
        }
        return transaction.department.update({
          where: { id: departmentId },
          data: { isActive: nextIsActive },
        });
      });
    },

    async transferMember(actor: Actor, memberId: string, destinationDepartmentId: string) {
      return database.$transaction(async (transaction) => {
        const [member, destination] = await Promise.all([
          transaction.user.findUnique({
            where: { id: memberId },
            select: { id: true, role: true, departmentId: true },
          }),
          transaction.department.findFirst({
            where: { id: destinationDepartmentId, isActive: true },
            select: { id: true },
          }),
        ]);
        if (!member) throw new DepartmentStoreError("MEMBER_NOT_FOUND");
        if (!destination) throw new DepartmentStoreError("DESTINATION_UNAVAILABLE");
        assertCanTransferMember(actor, member, destination.id);

        await transaction.user.update({
          where: { id: member.id },
          data: { departmentId: destination.id },
        });
        await transaction.departmentMembershipHistory.create({
          data: {
            memberId: member.id,
            fromDepartmentId: member.departmentId,
            toDepartmentId: destination.id,
            changedById: actor.id,
          },
        });
      });
    },
  };
}
