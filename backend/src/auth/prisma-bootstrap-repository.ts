import { Prisma, PrismaClient } from "@prisma/client";
import {
  PERMISSION_DESCRIPTIONS,
  ROLE_DESCRIPTIONS,
  ROLE_NAMES,
  ROLE_PERMISSION_MATRIX,
} from "./permissions.js";
import type { BootstrapRepository, BootstrapTransaction } from "./bootstrap.js";

export class PrismaBootstrapRepository implements BootstrapRepository {
  constructor(private readonly prisma: PrismaClient) {}

  transaction<T>(operation: (transaction: BootstrapTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      (transaction) => operation(new PrismaBootstrapTransaction(transaction)),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

class PrismaBootstrapTransaction implements BootstrapTransaction {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  async ensureRolePermissionMatrix(): Promise<void> {
    const roleIds = new Map<string, string>();
    const permissionIds = new Map<string, string>();

    for (const name of ROLE_NAMES) {
      const role = await this.transaction.role.upsert({
        where: { name },
        create: { name, description: ROLE_DESCRIPTIONS[name] },
        update: { description: ROLE_DESCRIPTIONS[name] },
        select: { id: true },
      });
      roleIds.set(name, role.id);
    }

    for (const [key, description] of Object.entries(PERMISSION_DESCRIPTIONS)) {
      const permission = await this.transaction.permission.upsert({
        where: { key },
        create: { key, description },
        update: { description },
        select: { id: true },
      });
      permissionIds.set(key, permission.id);
    }

    for (const name of ROLE_NAMES) {
      const roleId = roleIds.get(name);
      if (!roleId) throw new Error("Role seed data is inconsistent.");

      await this.transaction.rolePermission.createMany({
        data: ROLE_PERMISSION_MATRIX[name].map((permissionKey) => {
          const permissionId = permissionIds.get(permissionKey);
          if (!permissionId) throw new Error("Permission seed data is inconsistent.");
          return { roleId, permissionId };
        }),
        skipDuplicates: true,
      });
    }
  }

  async hasSuperAdmin(): Promise<boolean> {
    const count = await this.transaction.userRole.count({
      where: { role: { is: { name: "SUPER_ADMIN" } } },
    });
    return count > 0;
  }

  async userExists(email: string): Promise<boolean> {
    return Boolean(await this.transaction.user.findUnique({ where: { email }, select: { id: true } }));
  }

  async createSuperAdmin(input: { email: string; name: string; passwordHash: string }): Promise<void> {
    await this.transaction.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        status: "ACTIVE",
        userRoles: {
          create: { role: { connect: { name: "SUPER_ADMIN" } } },
        },
      },
    });
  }
}