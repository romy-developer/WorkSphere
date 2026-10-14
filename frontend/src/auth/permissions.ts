import type { AuthenticatedUser } from "./types";

export function hasPermission(user: AuthenticatedUser, permission: string): boolean {
  return user.permissions.includes(permission);
}