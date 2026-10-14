import { z } from "zod";
import type { PasswordHasher } from "./types.js";

const resetEmailSchema = z.string().trim().toLowerCase().email().max(320);

export interface AdminPasswordResetTransaction {
  findUserByEmail(email: string): Promise<{ id: string; isSuperAdmin: boolean } | null>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
}

export interface AdminPasswordResetRepository {
  transaction<T>(operation: (transaction: AdminPasswordResetTransaction) => Promise<T>): Promise<T>;
}

export class AdminPasswordResetInputError extends Error {
  constructor(failures: string[]) {
    super(`Invalid reset configuration: ${failures.join("; ")}.`);
    this.name = "AdminPasswordResetInputError";
  }
}

export class AdminPasswordResetUserNotFoundError extends Error {
  constructor() {
    super("No user exists for the configured Super Admin email.");
    this.name = "AdminPasswordResetUserNotFoundError";
  }
}

export class AdminPasswordResetRoleError extends Error {
  constructor() {
    super("The configured user does not have the SUPER_ADMIN role.");
    this.name = "AdminPasswordResetRoleError";
  }
}

export async function resetSuperAdminPassword(
  credentials: { email: string; password: string },
  repository: AdminPasswordResetRepository,
  hasher: PasswordHasher,
): Promise<void> {
  const parsedEmail = resetEmailSchema.safeParse(credentials.email);
  const passwordFailures = getPasswordPolicyFailures(credentials.password);
  const failures = [
    ...(!parsedEmail.success ? ["BOOTSTRAP_ADMIN_EMAIL must be a valid email address"] : []),
    ...passwordFailures,
  ];
  if (failures.length > 0 || !parsedEmail.success) {
    throw new AdminPasswordResetInputError(failures);
  }

  await repository.transaction(async (transaction) => {
    const user = await transaction.findUserByEmail(parsedEmail.data);
    if (!user) throw new AdminPasswordResetUserNotFoundError();
    if (!user.isSuperAdmin) throw new AdminPasswordResetRoleError();

    const passwordHash = await hasher.hash(credentials.password);
    await transaction.updatePasswordHash(user.id, passwordHash);
  });
}

function getPasswordPolicyFailures(password: string): string[] {
  const failures: string[] = [];
  if (password.length < 14 || password.length > 128) {
    failures.push("BOOTSTRAP_ADMIN_PASSWORD must be 14-128 characters");
  }
  if (!/[a-z]/.test(password)) failures.push("password must contain a lowercase letter");
  if (!/[A-Z]/.test(password)) failures.push("password must contain an uppercase letter");
  if (!/[0-9]/.test(password)) failures.push("password must contain a digit");
  if (!/[^A-Za-z0-9]/.test(password)) failures.push("password must contain a symbol");
  return failures;
}