import { Prisma, PrismaClient } from "@prisma/client";
import type { AuthRepository, AuthUserRecord, RoleMatrixRecord } from "./types.js";

const userInclude = {
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

type UserWithRoles = Prisma.UserGetPayload<{ include: typeof userInclude }>;

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { email }, include: userInclude });
    return user ? mapUser(user) : null;
  }

  async findById(id: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: userInclude });
    return user ? mapUser(user) : null;
  }

  async incrementSessionVersion(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    });
  }

  async listRoleMatrix(): Promise<RoleMatrixRecord[]> {
    const roles = await this.prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    });

    return roles.map((role) => ({
      name: role.name,
      description: role.description,
      permissions: role.rolePermissions.map(({ permission }) => permission.key).sort(),
    }));
  }
}

function mapUser(user: UserWithRoles): AuthUserRecord {
  const roles = user.userRoles.map(({ role }) => role);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash: user.passwordHash,
    status: user.status,
    sessionVersion: user.sessionVersion,
    roles: roles.map(({ name }) => name),
    permissions: roles.flatMap((role) =>
      role.rolePermissions.map(({ permission }) => permission.key),
    ),
  };
}