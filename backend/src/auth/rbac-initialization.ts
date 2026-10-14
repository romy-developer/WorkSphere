import { z } from "zod";
import {
  PERMISSION_DESCRIPTIONS,
  ROLE_DESCRIPTIONS,
  ROLE_PERMISSION_MATRIX,
} from "./permissions.js";

const configurationSchema = z.object({
  role: z.object({
    name: z.literal("SUPER_ADMIN"),
    description: z.string().trim().min(1).max(250),
  }).strict(),
  permissions: z.array(z.object({
    key: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(250),
  }).strict()).min(1),
}).strict();

export const SUPER_ADMIN_RBAC_CONFIGURATION = {
  role: {
    name: "SUPER_ADMIN",
    description: ROLE_DESCRIPTIONS.SUPER_ADMIN,
  },
  permissions: ROLE_PERMISSION_MATRIX.SUPER_ADMIN.map((key) => ({
    key,
    description: PERMISSION_DESCRIPTIONS[key],
  })),
};

export interface RbacInitializationTransaction {
  ensureRole(input: { name: string; description: string }): Promise<string>;
  ensurePermissions(inputs: { key: string; description: string }[]): Promise<Map<string, string>>;
  ensureRolePermissions(roleId: string, permissionIds: string[]): Promise<void>;
}

export interface RbacInitializationRepository {
  transaction<T>(operation: (transaction: RbacInitializationTransaction) => Promise<T>): Promise<T>;
}

export class RbacInitializationConfigurationError extends Error {
  constructor() {
    super("Super Admin RBAC initialization configuration is incomplete or invalid.");
    this.name = "RbacInitializationConfigurationError";
  }
}

export async function initializeSuperAdminRbac(
  repository: RbacInitializationRepository,
  configuration: unknown = SUPER_ADMIN_RBAC_CONFIGURATION,
): Promise<void> {
  const parsed = configurationSchema.safeParse(configuration);
  if (!parsed.success) throw new RbacInitializationConfigurationError();

  const configuredKeys = parsed.data.permissions.map(({ key }) => key);
  const requiredKeys = ROLE_PERMISSION_MATRIX.SUPER_ADMIN;
  if (
    new Set(configuredKeys).size !== configuredKeys.length ||
    configuredKeys.length !== requiredKeys.length ||
    requiredKeys.some((key) => !configuredKeys.includes(key))
  ) {
    throw new RbacInitializationConfigurationError();
  }

  await repository.transaction(async (transaction) => {
    const roleId = await transaction.ensureRole(parsed.data.role);
    const permissionIds = await transaction.ensurePermissions(parsed.data.permissions);
    const linkedPermissionIds: string[] = [];
    for (const key of requiredKeys) {
      const permissionId = permissionIds.get(key);
      if (!permissionId) throw new RbacInitializationConfigurationError();
      linkedPermissionIds.push(permissionId);
    }
    await transaction.ensureRolePermissions(roleId, linkedPermissionIds);
  });
}