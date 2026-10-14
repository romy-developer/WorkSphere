export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";