import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import type { AuthenticatedSession, AuthRepository, AuthUserRecord, PasswordHasher, PublicUser, RoleMatrixRecord } from "./types.js";
import { SessionTokenService } from "./token.js";

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password.");
    this.name = "InvalidCredentialsError";
  }
}

export class AuthService {
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly repository: AuthRepository,
    private readonly tokens: SessionTokenService,
    private readonly hasher: PasswordHasher = argon2,
  ) {}

  async login(email: string, password: string): Promise<AuthenticatedSession> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.repository.findByEmail(normalizedEmail);
    const passwordHash = user?.passwordHash ?? (await this.getDummyHash());
    let passwordMatches = false;

    try {
      passwordMatches = await this.hasher.verify(passwordHash, password);
    } catch {
      passwordMatches = false;
    }

    if (!user || user.status !== "ACTIVE" || !passwordMatches) {
      throw new InvalidCredentialsError();
    }

    return {
      user: toPublicUser(user),
      token: await this.tokens.issue(user.id, user.sessionVersion),
    };
  }

  async authenticate(token: string): Promise<PublicUser | null> {
    const claims = await this.tokens.verify(token);
    if (!claims) return null;

    const user = await this.repository.findById(claims.userId);
    if (
      !user ||
      user.status !== "ACTIVE" ||
      user.sessionVersion !== claims.sessionVersion
    ) {
      return null;
    }

    return toPublicUser(user);
  }

  async logout(userId: string): Promise<void> {
    await this.repository.incrementSessionVersion(userId);
  }

  listRoleMatrix(): Promise<RoleMatrixRecord[]> {
    return this.repository.listRoleMatrix();
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(randomBytes(32).toString("hex"));
    return this.dummyHash;
  }
}

function toPublicUser(user: AuthUserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: [...new Set(user.roles)].sort(),
    permissions: [...new Set(user.permissions)].sort(),
  };
}