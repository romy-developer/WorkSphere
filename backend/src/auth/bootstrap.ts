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
  ensureRolePermissionMatrix(): Promise<void>;
  hasSuperAdmin(): Promise<boolean>;
  userExists(email: string): Promise<boolean>;
  createSuperAdmin(input: { email: string; name: string; passwordHash: string }): Promise<void>;
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

export async function bootstrapSuperAdmin(
  credentials: { email: string; password: string },
  repository: BootstrapRepository,
  hasher: PasswordHasher,
): Promise<{ created: boolean; email: string }> {
  const parsed = bootstrapCredentialsSchema.safeParse(credentials);
  if (!parsed.success) {
    throw new BootstrapInputError(
      "Bootstrap requires a valid email and a 14-character password with upper-case, lower-case, numeric, and symbol characters.",
    );
  }

  return repository.transaction(async (transaction) => {
    await transaction.ensureRolePermissionMatrix();

    if (await transaction.hasSuperAdmin()) {
      return { created: false, email: parsed.data.email };
    }

    if (await transaction.userExists(parsed.data.email)) {
      throw new BootstrapEmailInUseError();
    }

    const passwordHash = await hasher.hash(parsed.data.password);
    await transaction.createSuperAdmin({
      email: parsed.data.email,
      name: "WorkSphere Administrator",
      passwordHash,
    });

    return { created: true, email: parsed.data.email };
  });
}