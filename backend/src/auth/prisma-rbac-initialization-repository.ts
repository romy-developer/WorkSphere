import { Prisma, PrismaClient } from "@prisma/client";
import type {
  RbacInitializationRepository,
  RbacInitializationTransaction,
} from "./rbac-initialization.js";

const MAX_TRANSACTION_ATTEMPTS = 3;

export class PrismaRbacInitializationRepository implements RbacInitializationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async transaction<T>(
    operation: (transaction: RbacInitializationTransaction) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          (transaction) => operation(new PrismaRbacInitializationTransaction(transaction)),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (attempt >= MAX_TRANSACTION_ATTEMPTS || !isInitializationRace(error)) throw error;
      }
    }
  }
}

function isInitializationRace(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002");
}

class PrismaRbacInitializationTransaction implements RbacInitializationTransaction {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  async ensureRole(input: { name: string; description: string }): Promise<string> {
    const role = await this.transaction.role.upsert({
      where: { name: input.name },
      create: input,
      update: {},
      select: { id: true },
    });
    return role.id;
  }

  async ensurePermissions(
    inputs: { key: string; description: string }[],
  ): Promise<Map<string, string>> {
    const permissions = new Map<string, string>();
    for (const input of inputs) {
      const permission = await this.transaction.permission.upsert({
        where: { key: input.key },
        create: input,
        update: {},
        select: { id: true },
      });
      permissions.set(input.key, permission.id);
    }
    return permissions;
  }

  async ensureRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    await this.transaction.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      skipDuplicates: true,
    });
  }
}