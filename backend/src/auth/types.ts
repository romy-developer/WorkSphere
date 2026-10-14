import type { UserStatus } from "@prisma/client";

export interface AuthUserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  status: UserStatus;
  sessionVersion: number;
  roles: string[];
  permissions: string[];
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}

export interface RoleMatrixRecord {
  name: string;
  description: string;
  permissions: string[];
}

export interface AuthRepository {
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  findById(id: string): Promise<AuthUserRecord | null>;
  incrementSessionVersion(userId: string): Promise<void>;
  listRoleMatrix(): Promise<RoleMatrixRecord[]>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
}

export interface AuthenticatedSession {
  user: PublicUser;
  token: string;
}