import { Prisma, PrismaClient } from "@prisma/client";
import { ROLE_PERMISSION_MATRIX } from "./permissions.js";
import type { BootstrapRepository, BootstrapTransaction } from "./bootstrap.js";

const MAX_TRANSACTION_ATTEMPTS = 3;

export class PrismaBootstrapRepository implements BootstrapRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async transaction<T>(operation: (transaction: BootstrapTransaction) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          (transaction) => operation(new PrismaBootstrapTransaction(transaction)),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (attempt >= MAX_TRANSACTION_ATTEMPTS || !isBootstrapRace(error)) throw error;
      }
    }
  }
}

function isBootstrapRace(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2034") return true;
  if (error.code !== "P2002") return false;

  const target = error.meta?.target;
  if (typeof target === "string") return target.toLowerCase().includes("email");
  return Array.isArray(target) && target.some(
    (field) => typeof field === "string" && field.toLowerCase().includes("email"),
  );
}

class PrismaBootstrapTransaction implements BootstrapTransaction {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  async inspectSuperAdminConfiguration() {
    const requiredPermissions = ROLE_PERMISSION_MATRIX.SUPER_ADMIN;
    const role = await this.transaction.role.findUnique({
      where: { name: "SUPER_ADMIN" },
      select: {
        rolePermissions: {
          select: { permission: { select: { key: true } } },
        },
      },
    });
    const permissions = await this.transaction.permission.findMany({
      where: { key: { in: [...requiredPermissions] } },
      select: { key: true },
    });
    const availablePermissions = new Set(permissions.map(({ key }) => key));
    const assignedPermissions = new Set(
      role?.rolePermissions.map(({ permission }) => permission.key) ?? [],
    );

    return {
      roleExists: role !== null,
      missingPermissions: requiredPermissions.filter((key) => !availablePermissions.has(key)),
      missingRolePermissions: role
        ? requiredPermissions.filter((key) => !assignedPermissions.has(key))
        : [],
    };
  }

  async findUserByEmail(email: string): Promise<{ isSuperAdmin: boolean } | null> {
    const user = await this.transaction.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: {
        userRoles: {
          select: { role: { select: { name: true } } },
        },
      },
    });
    if (!user) return null;
    return { isSuperAdmin: user.userRoles.some(({ role }) => role.name === "SUPER_ADMIN") };
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