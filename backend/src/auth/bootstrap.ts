import { z } from "zod";
import type { PasswordHasher } from "./types.js";

const bootstrapCredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z
    .string()
    .min(14)
    .max(128)
    .refine((value) => /[a-z]/.test(value))
    .refine((value) => /[A-Z]/.test(value))
    .refine((value) => /[0-9]/.test(value))
    .refine((value) => /[^A-Za-z0-9]/.test(value)),
}).strict();

export interface BootstrapTransaction {
  inspectSuperAdminConfiguration(): Promise<SuperAdminConfiguration>;
  findUserByEmail(email: string): Promise<{ isSuperAdmin: boolean } | null>;
  hasSuperAdmin(): Promise<boolean>;
  createSuperAdmin(input: { email: string; name: string; passwordHash: string }): Promise<void>;
}

export interface SuperAdminConfiguration {
  roleExists: boolean;
  missingPermissions: string[];
  missingRolePermissions: string[];
}

export interface BootstrapRepository {
  transaction<T>(operation: (transaction: BootstrapTransaction) => Promise<T>): Promise<T>;
}

export class BootstrapInputError extends Error {
  constructor(message = "Bootstrap credentials are missing or invalid.") {
    super(message);
    this.name = "BootstrapInputError";
  }
}

export class BootstrapEmailInUseError extends Error {
  constructor() {
    super("The bootstrap email already belongs to a non-administrator account.");
    this.name = "BootstrapEmailInUseError";
  }
}

export class BootstrapConfigurationError extends Error {
  constructor(readonly missingConfiguration: string[]) {
    super(`Bootstrap is blocked by incomplete RBAC configuration: ${missingConfiguration.join(", ")}.`);
    this.name = "BootstrapConfigurationError";
  }
}

export type BootstrapResult =
  | { status: "created" }
  | { status: "already_exists" };

export async function bootstrapSuperAdmin(
  credentials: { email: string; password: string },
  repository: BootstrapRepository,
  hasher: PasswordHasher,
): Promise<BootstrapResult> {
  const parsed = bootstrapCredentialsSchema.safeParse(credentials);
  if (!parsed.success) {
    throw new BootstrapInputError(
      "Bootstrap requires a valid email and a 14-character password with upper-case, lower-case, numeric, and symbol characters.",
    );
  }

  return repository.transaction(async (transaction) => {
    const configuration = await transaction.inspectSuperAdminConfiguration();
    const missingConfiguration: string[] = [];
    if (!configuration.roleExists) missingConfiguration.push("SUPER_ADMIN role");
    if (configuration.missingPermissions.length > 0) {
      missingConfiguration.push(`permissions ${configuration.missingPermissions.join(", ")}`);
    }
    if (configuration.missingRolePermissions.length > 0) {
      missingConfiguration.push(
        `SUPER_ADMIN assignments ${configuration.missingRolePermissions.join(", ")}`,
      );
    }
    if (missingConfiguration.length > 0) {
      throw new BootstrapConfigurationError(missingConfiguration);
    }

    const existingUser = await transaction.findUserByEmail(parsed.data.email);
    if (existingUser?.isSuperAdmin) {
      return { status: "already_exists" };
    }
    if (existingUser) {
      throw new BootstrapEmailInUseError();
    }
    if (await transaction.hasSuperAdmin()) return { status: "already_exists" };

    const passwordHash = await hasher.hash(parsed.data.password);
    await transaction.createSuperAdmin({
      email: parsed.data.email,
      name: "WorkSphere Administrator",
      passwordHash,
    });

    return { status: "created" };
  });
}