import { Prisma, PrismaClient } from "@prisma/client";
import type {
  AdminPasswordResetRepository,
  AdminPasswordResetTransaction,
} from "./admin-password-reset.js";

export class PrismaAdminPasswordResetRepository implements AdminPasswordResetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  transaction<T>(
    operation: (transaction: AdminPasswordResetTransaction) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      (transaction) => operation(new PrismaAdminPasswordResetTransaction(transaction)),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

class PrismaAdminPasswordResetTransaction implements AdminPasswordResetTransaction {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  async findUserByEmail(email: string): Promise<{ id: string; isSuperAdmin: boolean } | null> {
    const user = await this.transaction.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: {
        id: true,
        userRoles: {
          select: { role: { select: { name: true } } },
        },
      },
    });
    if (!user) return null;

    return {
      id: user.id,
      isSuperAdmin: user.userRoles.some(({ role }) => role.name === "SUPER_ADMIN"),
    };
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    const updatedRows = await this.transaction.$executeRaw(
      Prisma.sql`UPDATE "User" SET "passwordHash" = ${passwordHash} WHERE "id" = ${userId}::uuid`,
    );
    if (updatedRows !== 1) throw new Error("The Super Admin password update target changed.");
  }
}