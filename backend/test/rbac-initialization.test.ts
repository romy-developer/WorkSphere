import { describe, expect, it } from "vitest";
import {
  initializeSuperAdminRbac,
  RbacInitializationConfigurationError,
  SUPER_ADMIN_RBAC_CONFIGURATION,
} from "../src/auth/rbac-initialization.js";
import type {
  RbacInitializationRepository,
  RbacInitializationTransaction,
} from "../src/auth/rbac-initialization.js";

class FakeRbacInitializationRepository implements RbacInitializationRepository {
  roles = new Map<string, { id: string; description: string }>();
  permissions = new Map<string, { id: string; description: string }>();
  rolePermissions = new Set<string>();
  transactionCalls = 0;

  transaction<T>(operation: (transaction: RbacInitializationTransaction) => Promise<T>): Promise<T> {
    this.transactionCalls += 1;
    return operation({
      ensureRole: async ({ name, description }) => {
        const role = this.roles.get(name) ?? { id: `role:${name}`, description };
        this.roles.set(name, role);
        return role.id;
      },
      ensurePermissions: async (inputs) => {
        const ids = new Map<string, string>();
        for (const { key, description } of inputs) {
          const permission = this.permissions.get(key) ?? { id: `permission:${key}`, description };
          this.permissions.set(key, permission);
          ids.set(key, permission.id);
        }
        return ids;
      },
      ensureRolePermissions: async (roleId, permissionIds) => {
        for (const permissionId of permissionIds) {
          this.rolePermissions.add(`${roleId}:${permissionId}`);
        }
      },
    });
  }
}

describe("Super Admin RBAC initialization", () => {
  it("creates only the approved role, permissions, and links", async () => {
    const repository = new FakeRbacInitializationRepository();

    await initializeSuperAdminRbac(repository);

    expect([...repository.roles.keys()]).toEqual(["SUPER_ADMIN"]);
    expect([...repository.permissions.keys()].sort()).toEqual(
      SUPER_ADMIN_RBAC_CONFIGURATION.permissions.map(({ key }) => key).sort(),
    );
    expect(repository.rolePermissions.size).toBe(7);
  });

  it("is idempotent on repeated execution and preserves existing descriptions", async () => {
    const repository = new FakeRbacInitializationRepository();
    repository.roles.set("SUPER_ADMIN", { id: "existing-role", description: "Keep this description" });

    await initializeSuperAdminRbac(repository);
    await initializeSuperAdminRbac(repository);

    expect(repository.roles.size).toBe(1);
    expect(repository.roles.get("SUPER_ADMIN")?.description).toBe("Keep this description");
    expect(repository.permissions.size).toBe(7);
    expect(repository.rolePermissions.size).toBe(7);
  });

  it("rejects an incomplete permission configuration before opening a transaction", async () => {
    const repository = new FakeRbacInitializationRepository();
    const incompleteConfiguration = {
      ...SUPER_ADMIN_RBAC_CONFIGURATION,
      permissions: SUPER_ADMIN_RBAC_CONFIGURATION.permissions.slice(1),
    };

    await expect(
      initializeSuperAdminRbac(repository, incompleteConfiguration),
    ).rejects.toBeInstanceOf(RbacInitializationConfigurationError);
    expect(repository.transactionCalls).toBe(0);
  });

  it("rejects an unapproved permission key before opening a transaction", async () => {
    const repository = new FakeRbacInitializationRepository();
    const invalidConfiguration = {
      ...SUPER_ADMIN_RBAC_CONFIGURATION,
      permissions: SUPER_ADMIN_RBAC_CONFIGURATION.permissions.map((permission, index) =>
        index === 0 ? { ...permission, key: "users.delete" } : permission,
      ),
    };

    await expect(
      initializeSuperAdminRbac(repository, invalidConfiguration),
    ).rejects.toBeInstanceOf(RbacInitializationConfigurationError);
    expect(repository.transactionCalls).toBe(0);
  });
});