import { describe, expect, it, vi } from "vitest";
import type { BootstrapRepository, BootstrapTransaction } from "../src/auth/bootstrap.js";
import {
  BootstrapEmailInUseError,
  BootstrapInputError,
  bootstrapSuperAdmin,
} from "../src/auth/bootstrap.js";

const validCredentials = {
  email: "initial-admin@example.test",
  password: "Initial!AdminPass123",
};

class FakeBootstrapRepository implements BootstrapRepository, BootstrapTransaction {
  superAdminExists = false;
  emailExists = false;
  seeded = false;
  created: { email: string; name: string; passwordHash: string } | undefined;

  transaction<T>(operation: (transaction: BootstrapTransaction) => Promise<T>): Promise<T> {
    return operation(this);
  }

  async ensureRolePermissionMatrix(): Promise<void> {
    this.seeded = true;
  }

  async hasSuperAdmin(): Promise<boolean> {
    return this.superAdminExists;
  }

  async userExists(): Promise<boolean> {
    return this.emailExists;
  }

  async createSuperAdmin(input: { email: string; name: string; passwordHash: string }): Promise<void> {
    this.created = input;
  }
}

const fakeHasher = {
  hash: vi.fn(async (password: string) => `argon2-hash:${password}`),
  verify: vi.fn(async () => false),
};

describe("initial administrator bootstrap", () => {
  it("creates the first administrator with a hash and seeds the role matrix", async () => {
    const repository = new FakeBootstrapRepository();

    const result = await bootstrapSuperAdmin(validCredentials, repository, fakeHasher);

    expect(result.created).toBe(true);
    expect(repository.seeded).toBe(true);
    expect(repository.created).toMatchObject({
      email: validCredentials.email,
      name: "WorkSphere Administrator",
      passwordHash: `argon2-hash:${validCredentials.password}`,
    });
  });

  it("does not hash or replace a password when a Super Admin already exists", async () => {
    const repository = new FakeBootstrapRepository();
    repository.superAdminExists = true;
    repository.created = {
      email: "existing-admin@example.test",
      name: "Existing Administrator",
      passwordHash: "unchanged-existing-hash",
    };
    fakeHasher.hash.mockClear();

    const result = await bootstrapSuperAdmin(validCredentials, repository, fakeHasher);

    expect(result.created).toBe(false);
    expect(fakeHasher.hash).not.toHaveBeenCalled();
    expect(repository.created.passwordHash).toBe("unchanged-existing-hash");
  });

  it("rejects weak credentials and an existing non-admin email", async () => {
    const repository = new FakeBootstrapRepository();
    await expect(
      bootstrapSuperAdmin({ email: "bad", password: "weak" }, repository, fakeHasher),
    ).rejects.toBeInstanceOf(BootstrapInputError);

    repository.emailExists = true;
    await expect(
      bootstrapSuperAdmin(validCredentials, repository, fakeHasher),
    ).rejects.toBeInstanceOf(BootstrapEmailInUseError);
  });
});