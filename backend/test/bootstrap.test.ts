import { describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { BootstrapRepository, BootstrapTransaction } from "../src/auth/bootstrap.js";
import {
  BootstrapConfigurationError,
  BootstrapEmailInUseError,
  BootstrapInputError,
  bootstrapSuperAdmin,
} from "../src/auth/bootstrap.js";
import { PrismaBootstrapRepository } from "../src/auth/prisma-bootstrap-repository.js";

const validCredentials = {
  email: "initial-admin@example.test",
  password: "Initial!AdminPass123",
};

class FakeBootstrapRepository implements BootstrapRepository, BootstrapTransaction {
  superAdminExists = false;
  configuration = {
    roleExists: true,
    missingPermissions: [],
    missingRolePermissions: [],
  };
  users = new Map<string, boolean>();
  created: { email: string; name: string; passwordHash: string } | undefined;

  transaction<T>(operation: (transaction: BootstrapTransaction) => Promise<T>): Promise<T> {
    return operation(this);
  }

  async inspectSuperAdminConfiguration() {
    return this.configuration;
  }

  async findUserByEmail(email: string): Promise<{ isSuperAdmin: boolean } | null> {
    const entry = [...this.users.entries()].find(
      ([existingEmail]) => existingEmail.toLowerCase() === email.toLowerCase(),
    );
    const isSuperAdmin = entry?.[1];
    return isSuperAdmin === undefined ? null : { isSuperAdmin };
  }

  async hasSuperAdmin(): Promise<boolean> {
    return this.superAdminExists;
  }

  async createSuperAdmin(input: { email: string; name: string; passwordHash: string }): Promise<void> {
    this.created = input;
    this.users.set(input.email, true);
    this.superAdminExists = true;
  }
}

const fakeHasher = {
  hash: vi.fn(async (password: string) => `argon2-hash:${password}`),
  verify: vi.fn(async () => false),
};

describe("initial administrator bootstrap", () => {
  it("creates the first administrator with a hash and existing RBAC configuration", async () => {
    const repository = new FakeBootstrapRepository();

    const result = await bootstrapSuperAdmin(validCredentials, repository, fakeHasher);

    expect(result).toEqual({ status: "created" });
    expect(repository.created).toMatchObject({
      email: validCredentials.email,
      name: "WorkSphere Administrator",
      passwordHash: `argon2-hash:${validCredentials.password}`,
    });
  });

  it("is safe to repeat and never hashes or replaces a password again", async () => {
    const repository = new FakeBootstrapRepository();
    fakeHasher.hash.mockClear();

    const first = await bootstrapSuperAdmin(validCredentials, repository, fakeHasher);
    const createdAccount = repository.created;
    const second = await bootstrapSuperAdmin(validCredentials, repository, fakeHasher);

    expect(first.status).toBe("created");
    expect(second).toEqual({ status: "already_exists" });
    expect(fakeHasher.hash).toHaveBeenCalledTimes(1);
    expect(repository.created).toBe(createdAccount);
  });

  it("rejects an email that already belongs to a non-admin without elevating it", async () => {
    const repository = new FakeBootstrapRepository();
    repository.users.set(validCredentials.email.toUpperCase(), false);
    fakeHasher.hash.mockClear();

    await expect(
      bootstrapSuperAdmin(validCredentials, repository, fakeHasher),
    ).rejects.toBeInstanceOf(BootstrapEmailInUseError);
    expect([...repository.users.values()]).toEqual([false]);
    expect(repository.created).toBeUndefined();
    expect(fakeHasher.hash).not.toHaveBeenCalled();
  });

  it("fails before hashing when the Super Admin role or permission links are missing", async () => {
    const repository = new FakeBootstrapRepository();
    repository.configuration = {
      roleExists: false,
      missingPermissions: ["employees.manage"],
      missingRolePermissions: ["dashboard.view"],
    };
    fakeHasher.hash.mockClear();

    await expect(
      bootstrapSuperAdmin(validCredentials, repository, fakeHasher),
    ).rejects.toMatchObject({
      constructor: BootstrapConfigurationError,
      missingConfiguration: [
        "SUPER_ADMIN role",
        "permissions employees.manage",
        "SUPER_ADMIN assignments dashboard.view",
      ],
    });
    expect(repository.created).toBeUndefined();
    expect(fakeHasher.hash).not.toHaveBeenCalled();
  });

  it("rejects weak credentials before any repository access", async () => {
    const repository = new FakeBootstrapRepository();

    await expect(
      bootstrapSuperAdmin({ email: "bad", password: "weak" }, repository, fakeHasher),
    ).rejects.toBeInstanceOf(BootstrapInputError);
    expect(repository.created).toBeUndefined();
  });

  it("rechecks state after a concurrent serializable transaction wins", async () => {
    let attempts = 0;
    let competingAdminExists = false;
    const conflict = new Prisma.PrismaClientKnownRequestError("Transaction conflict", {
      code: "P2034",
      clientVersion: "test",
    });
    const prisma = {
      $transaction: vi.fn(async (operation: (transaction: object) => Promise<string>) => {
        attempts += 1;
        if (attempts === 1) {
          await operation({});
          competingAdminExists = true;
          throw conflict;
        }
        return operation({});
      }),
    } as unknown as PrismaClient;
    const repository = new PrismaBootstrapRepository(prisma);

    const result = await repository.transaction(async () =>
      competingAdminExists ? "already_exists" : "created",
    );

    expect(result).toBe("already_exists");
    expect(attempts).toBe(2);
  });

  it("rechecks state after a concurrent email uniqueness conflict", async () => {
    let attempts = 0;
    let competingUserExists = false;
    const conflict = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["email"] },
    });
    const prisma = {
      $transaction: vi.fn(async (operation: (transaction: object) => Promise<string>) => {
        attempts += 1;
        if (attempts === 1) {
          await operation({});
          competingUserExists = true;
          throw conflict;
        }
        return operation({});
      }),
    } as unknown as PrismaClient;
    const repository = new PrismaBootstrapRepository(prisma);

    const result = await repository.transaction(async () =>
      competingUserExists ? "existing_user" : "created",
    );

    expect(result).toBe("existing_user");
    expect(attempts).toBe(2);
  });
});