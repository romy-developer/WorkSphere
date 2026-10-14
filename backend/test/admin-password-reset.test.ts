import { describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  AdminPasswordResetInputError,
  AdminPasswordResetRoleError,
  AdminPasswordResetUserNotFoundError,
  resetSuperAdminPassword,
} from "../src/auth/admin-password-reset.js";
import { PrismaAdminPasswordResetRepository } from "../src/auth/prisma-admin-password-reset-repository.js";
import type {
  AdminPasswordResetRepository,
  AdminPasswordResetTransaction,
} from "../src/auth/admin-password-reset.js";

const credentials = {
  email: "  ADMIN@EXAMPLE.TEST ",
  password: "Strong!AdminPassword123",
};

class FakePasswordResetRepository implements AdminPasswordResetRepository, AdminPasswordResetTransaction {
  user: { id: string; isSuperAdmin: boolean } | null = { id: "admin-id", isSuperAdmin: true };
  lookupEmail: string | undefined;
  update: { userId: string; passwordHash: string } | undefined;
  transactionCalls = 0;

  transaction<T>(operation: (transaction: AdminPasswordResetTransaction) => Promise<T>): Promise<T> {
    this.transactionCalls += 1;
    return operation(this);
  }

  async findUserByEmail(email: string): Promise<{ id: string; isSuperAdmin: boolean } | null> {
    this.lookupEmail = email;
    return this.user;
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    this.update = { userId, passwordHash };
  }
}

describe("Super Admin password reset", () => {
  it("normalizes the email and updates only the selected user's password hash", async () => {
    const repository = new FakePasswordResetRepository();
    const hasher = { hash: vi.fn(async () => "argon2id-test-hash"), verify: vi.fn() };

    await resetSuperAdminPassword(credentials, repository, hasher);

    expect(repository.lookupEmail).toBe("admin@example.test");
    expect(hasher.hash).toHaveBeenCalledWith(credentials.password);
    expect(repository.update).toEqual({
      userId: "admin-id",
      passwordHash: "argon2id-test-hash",
    });
  });

  it("rejects invalid email or password policy before opening a transaction", async () => {
    const repository = new FakePasswordResetRepository();
    const hasher = { hash: vi.fn(), verify: vi.fn() };

    await expect(
      resetSuperAdminPassword({ email: "bad-email", password: credentials.password }, repository, hasher),
    ).rejects.toBeInstanceOf(AdminPasswordResetInputError);
    await expect(
      resetSuperAdminPassword({ email: credentials.email, password: "weak" }, repository, hasher),
    ).rejects.toBeInstanceOf(AdminPasswordResetInputError);
    expect(repository.transactionCalls).toBe(0);
    expect(hasher.hash).not.toHaveBeenCalled();
  });

  it("accepts a password at the 14-character boundary when all character classes are present", async () => {
    const repository = new FakePasswordResetRepository();
    const hasher = { hash: vi.fn(async () => "argon2id-test-hash"), verify: vi.fn() };

    await resetSuperAdminPassword(
      { email: "admin@example.test", password: "Aa!23456789012" },
      repository,
      hasher,
    );

    expect(repository.update?.passwordHash).toBe("argon2id-test-hash");
  });

  it("reports failed password requirements without including the password", async () => {
    const repository = new FakePasswordResetRepository();
    const hasher = { hash: vi.fn(), verify: vi.fn() };

    await expect(
      resetSuperAdminPassword(
        { email: "admin@example.test", password: "lowercaseonly123" },
        repository,
        hasher,
      ),
    ).rejects.toMatchObject({
      message: expect.stringContaining("password must contain an uppercase letter"),
    });
    expect(repository.transactionCalls).toBe(0);
    expect(hasher.hash).not.toHaveBeenCalled();
  });

  it("stops when the configured user does not exist", async () => {
    const repository = new FakePasswordResetRepository();
    repository.user = null;
    const hasher = { hash: vi.fn(), verify: vi.fn() };

    await expect(
      resetSuperAdminPassword(credentials, repository, hasher),
    ).rejects.toBeInstanceOf(AdminPasswordResetUserNotFoundError);
    expect(repository.update).toBeUndefined();
    expect(hasher.hash).not.toHaveBeenCalled();
  });

  it("stops when the configured user does not have the Super Admin role", async () => {
    const repository = new FakePasswordResetRepository();
    repository.user = { id: "ordinary-user-id", isSuperAdmin: false };
    const hasher = { hash: vi.fn(), verify: vi.fn() };

    await expect(
      resetSuperAdminPassword(credentials, repository, hasher),
    ).rejects.toBeInstanceOf(AdminPasswordResetRoleError);
    expect(repository.update).toBeUndefined();
    expect(hasher.hash).not.toHaveBeenCalled();
  });

  it("uses a serializable Prisma transaction and changes no other database column", async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    let transactionOptions: unknown;
    const prisma = {
      $transaction: vi.fn(async (operation: (transaction: object) => Promise<void>, options: unknown) => {
        transactionOptions = options;
        return operation({ $executeRaw: executeRaw });
      }),
    } as unknown as PrismaClient;
    const repository = new PrismaAdminPasswordResetRepository(prisma);

    await repository.transaction((transaction) =>
      transaction.updatePasswordHash("admin-id", "replacement-hash"),
    );

    const statement = executeRaw.mock.calls[0][0] as Prisma.Sql;
    expect(transactionOptions).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    expect(statement.sql).toContain('UPDATE "User" SET "passwordHash" =');
    expect(statement.sql).toContain('WHERE "id" =');
    expect(statement.sql).not.toContain('"updatedAt"');
    expect(statement.values).toEqual(["replacement-hash", "admin-id"]);
  });
});