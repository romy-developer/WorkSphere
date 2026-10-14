import type { AuthRepository, AuthUserRecord, RoleMatrixRecord } from "../src/auth/types.js";
import { AuthService } from "../src/auth/service.js";
import { SessionTokenService } from "../src/auth/token.js";
import { createApp } from "../src/app.js";

export const TEST_PASSWORD = "TestOnly!Password123";

export const testHasher = {
  hash: async (password: string) => `test-hash:${password}`,
  verify: async (passwordHash: string, password: string) => passwordHash === `test-hash:${password}`,
};

export function makeUser(overrides: Partial<AuthUserRecord> = {}): AuthUserRecord {
  return {
    id: "user-1",
    email: "admin@example.test",
    name: "Test Administrator",
    passwordHash: `test-hash:${TEST_PASSWORD}`,
    status: "ACTIVE",
    sessionVersion: 0,
    roles: ["SUPER_ADMIN"],
    permissions: [
      "dashboard.view",
      "roles.manage",
      "users.read",
      "users.create",
      "users.update",
      "employees.read",
      "employees.manage",
    ],
    ...overrides,
  };
}

export class InMemoryAuthRepository implements AuthRepository {
  readonly users: AuthUserRecord[];
  readonly roleMatrix: RoleMatrixRecord[];

  constructor(users: AuthUserRecord[] = [], roleMatrix: RoleMatrixRecord[] = []) {
    this.users = users.map(cloneUser);
    this.roleMatrix = roleMatrix;
  }

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = this.users.find((candidate) => candidate.email === email);
    return user ? cloneUser(user) : null;
  }

  async findById(id: string): Promise<AuthUserRecord | null> {
    const user = this.users.find((candidate) => candidate.id === id);
    return user ? cloneUser(user) : null;
  }

  async incrementSessionVersion(userId: string): Promise<void> {
    const user = this.users.find((candidate) => candidate.id === userId);
    if (user) user.sessionVersion += 1;
  }

  async listRoleMatrix(): Promise<RoleMatrixRecord[]> {
    return this.roleMatrix;
  }
}

export function createTestApp(users: AuthUserRecord[] = [], roleMatrix: RoleMatrixRecord[] = []) {
  const repository = new InMemoryAuthRepository(users, roleMatrix);
  const authService = new AuthService(
    repository,
    new SessionTokenService("test-only-token-secret-value-at-least-32-bytes"),
    testHasher,
  );

  return {
    app: createApp({
      authService,
      frontendOrigin: "http://localhost:5173",
      secureCookies: false,
    }),
    repository,
  };
}

function cloneUser(user: AuthUserRecord): AuthUserRecord {
  return { ...user, roles: [...user.roles], permissions: [...user.permissions] };
}